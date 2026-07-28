// argus-assistant — asystent AI polityka (zakładka Asystent, wejście z Pulpitu).
// Operacje:
//   - ask: pytanie (+ opcjonalne conversation_id) → odpowiedź STRUMIENIEM SSE
//     (data: {type: meta|delta|done|error}). Brak conversation_id zakłada nową
//     rozmowę; historia wątku żyje w bazie (assistant_messages), klient nic
//     nie przechowuje.
//   - list_conversations: historia rozmów tenanta (po ostatniej aktywności),
//   - get_conversation: wiadomości jednej rozmowy.
//
// Kontekst wstrzykiwany do promptu: profil polityka (styl, cele, wartości,
// granice, kontekst ręczny) + dzisiejszy brief dnia, jeśli jest gotowy.
// Model: Sonnet. Projekt: docs/superpowers/specs/2026-07-27-asystent-argus-design.md
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getGenerationModel, loadPrompt } from "../_shared/ai.ts";
import { authenticateRequest, getTenantId, HttpError } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { today } from "../_shared/daily-brief.ts";
import { searchOpinionContext } from "../_shared/knowledge-search.ts";
import { jsonResponse, serverErrorResponse } from "../_shared/types.ts";

const QUESTION_MIN_LENGTH = 3;
/**
 * Limit chroni przed wklejeniem całego dokumentu, nie przed kontekstem modelu
 * (Sonnet mieści dużo więcej). Musi pomieścić skróty zagadnień z przycisków
 * „Rozmawiaj z asystentem" (do 2600 znaków, src/lib/topic-assistant.ts).
 */
const QUESTION_MAX_LENGTH = 6000;
/** Ostatnie wpisy wątku trafiające do promptu (para = pytanie + odpowiedź). */
const HISTORY_MAX_MESSAGES = 20;
const CONVERSATION_TITLE_MAX_LENGTH = 80;
const LIST_LIMIT = 50;

interface BriefItem {
  naglowek?: string;
  streszczenie?: string;
  znaczenie_dla_ciebie?: string;
}

/** Blok kontekstu: profil polityka + dzisiejszy brief dnia (jeśli gotowy). */
async function buildContext(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<{ context: string; usedBrief: boolean }> {
  const { data: profile } = await supabase
    .from("politician_profiles")
    .select(
      "full_name, style_profile, goals, values, boundaries, bio, party_profile, topic_positions",
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const { data: brief } = await supabase
    .from("daily_briefs")
    .select("lead, items, status")
    .eq("tenant_id", tenantId)
    .eq("brief_date", today())
    .maybeSingle();

  const items = (brief?.items ?? []) as BriefItem[];
  const usedBrief = brief?.status === "ready" && items.length > 0;

  const lines = [
    `Polityk: ${profile?.full_name ?? "brak danych"}`,
    "",
    "Profil stylu językowego:",
    JSON.stringify(profile?.style_profile ?? {}, null, 2),
    "",
    "Cele:",
    JSON.stringify(profile?.goals ?? {}, null, 2),
    "",
    "Wartości i osie poglądów:",
    JSON.stringify(profile?.values ?? {}, null, 2),
    "",
    "Granice (czego nie robi, kogo nie atakuje):",
    JSON.stringify(profile?.boundaries ?? {}, null, 2),
    "",
    `O kandydacie: ${typeof profile?.bio === "string" && profile.bio ? profile.bio : "brak danych"}`,
    "",
    `O partii: ${typeof profile?.party_profile === "string" && profile.party_profile ? profile.party_profile : "brak danych"}`,
    "",
    `Stanowiska wobec tematów: ${typeof profile?.topic_positions === "string" && profile.topic_positions ? profile.topic_positions : "brak danych"}`,
    "",
  ];

  if (usedBrief) {
    lines.push(`Przegląd dnia (${today()}): ${brief?.lead ?? ""}`);
    for (const [i, item] of items.entries()) {
      lines.push(
        `[${i + 1}] ${item.naglowek ?? ""}\n    ${item.streszczenie ?? ""}\n    kąt strategiczny: ${item.znaczenie_dla_ciebie ?? ""}`,
      );
    }
  } else {
    lines.push("Przegląd dnia: nie został jeszcze dziś wygenerowany.");
  }

  return { context: lines.join("\n"), usedBrief };
}

/** Treść odpowiedzi LangChain bywa stringiem albo listą bloków — sklejamy tekst. */
function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === "string") return block;
        if (typeof block === "object" && block !== null && "text" in block) {
          const text = (block as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("");
  }
  return "";
}

/** Wątek rozmowy tenanta albo 404, żeby cudze id nie przechodziło po cichu. */
async function getConversation(
  supabase: SupabaseClient,
  tenantId: string,
  conversationId: string,
) {
  const { data, error } = await supabase
    .from("assistant_conversations")
    .select("id, title, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new HttpError(404, "Nie ma takiej rozmowy");
  return data;
}

async function loadHistory(
  supabase: SupabaseClient,
  tenantId: string,
  conversationId: string,
): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const { data, error } = await supabase
    .from("assistant_messages")
    .select("role, content, created_at")
    .eq("tenant_id", tenantId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_MAX_MESSAGES);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .reverse()
    .map((row) => ({
      role: row.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: String(row.content ?? ""),
    }));
}

/** Jedno zdarzenie SSE. */
function sseEvent(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

/**
 * Operacja ask: waliduje pytanie, dopina (albo zakłada) wątek, zapisuje
 * pytanie i strumieniuje odpowiedź modelu jako SSE. Odpowiedź asystenta
 * trafia do bazy po dostrumieniowaniu całości.
 */
async function opAskStream(
  supabase: SupabaseClient,
  tenantId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (question.length < QUESTION_MIN_LENGTH) {
    throw new HttpError(400, "Podaj pytanie (co najmniej 3 znaki)");
  }
  if (question.length > QUESTION_MAX_LENGTH) {
    throw new HttpError(400, `Pytanie jest za długie (limit ${QUESTION_MAX_LENGTH} znaków)`);
  }

  // Wątek: podany (musi należeć do tenanta) albo nowy z tytułem z pytania.
  let conversationId: string;
  if (typeof body.conversation_id === "string" && body.conversation_id) {
    conversationId = (await getConversation(supabase, tenantId, body.conversation_id)).id;
  } else {
    const title = question.length > CONVERSATION_TITLE_MAX_LENGTH
      ? `${question.slice(0, CONVERSATION_TITLE_MAX_LENGTH).trimEnd()}…`
      : question;
    const { data, error } = await supabase
      .from("assistant_conversations")
      .insert({ tenant_id: tenantId, title })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Nie udało się założyć rozmowy");
    conversationId = data.id;
  }

  // Historia sprzed tego pytania + zapis pytania (przetrwa nawet padnięty stream).
  const history = await loadHistory(supabase, tenantId, conversationId);
  const { error: insertError } = await supabase
    .from("assistant_messages")
    .insert({
      tenant_id: tenantId,
      conversation_id: conversationId,
      role: "user",
      content: question,
    });
  if (insertError) throw new Error(insertError.message);

  const { context, usedBrief } = await buildContext(supabase, tenantId);
  // Grounding w realnych badaniach opinii (CBOS) dopasowanych do pytania.
  // Fail-soft: gdy brak trafien albo dane jeszcze niezaladowane, zwraca "".
  const opinion = await searchOpinionContext(supabase, question);
  const systemPrompt = opinion
    ? `${loadPrompt("assistant-ask")}\n\n## Kontekst polityka i dnia\n\n${context}\n\n${opinion}`
    : `${loadPrompt("assistant-ask")}\n\n## Kontekst polityka i dnia\n\n${context}`;
  const model = await getGenerationModel();
  const messages: [string, string][] = [
    ["system", systemPrompt],
    ...history.map(
      (msg): [string, string] => [msg.role === "user" ? "human" : "ai", msg.content],
    ),
    ["human", question],
  ];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(sseEvent({ type: "meta", conversation_id: conversationId }));

        let full = "";
        const chunks = await model.stream(messages);
        for await (const chunk of chunks) {
          const text = contentToText(chunk.content);
          if (text) {
            full += text;
            controller.enqueue(sseEvent({ type: "delta", text }));
          }
        }

        const answer = full.trim();
        if (!answer) throw new Error("Model zwrócił pustą odpowiedź");

        // Zapis odpowiedzi + podbicie updated_at wątku (sortowanie historii).
        const { error: answerError } = await supabase
          .from("assistant_messages")
          .insert({
            tenant_id: tenantId,
            conversation_id: conversationId,
            role: "assistant",
            content: answer,
          });
        if (answerError) throw new Error(answerError.message);
        await supabase
          .from("assistant_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("tenant_id", tenantId)
          .eq("id", conversationId);

        controller.enqueue(sseEvent({ type: "done", used_brief: usedBrief }));
      } catch (err) {
        // Treść błędu zostaje w logach; do klienta idzie komunikat ogólny.
        console.error("argus-assistant stream error:", err);
        controller.enqueue(
          sseEvent({
            type: "error",
            message: "Nie udało się dokończyć odpowiedzi. Spróbuj ponownie.",
          }),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}

async function opListConversations(supabase: SupabaseClient, tenantId: string) {
  const { data, error } = await supabase
    .from("assistant_conversations")
    .select("id, title, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw new Error(error.message);
  return { conversations: data ?? [] };
}

async function opGetConversation(
  supabase: SupabaseClient,
  tenantId: string,
  body: Record<string, unknown>,
) {
  if (typeof body.conversation_id !== "string" || !body.conversation_id) {
    throw new HttpError(400, "Podaj conversation_id");
  }
  const conversation = await getConversation(supabase, tenantId, body.conversation_id);
  const { data, error } = await supabase
    .from("assistant_messages")
    .select("role, content, created_at")
    .eq("tenant_id", tenantId)
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return { conversation, messages: data ?? [] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user, supabase } = await authenticateRequest(req);
    const tenantId = await getTenantId(supabase, user.id);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    switch (body?.operation) {
      case "ask":
        return await opAskStream(supabase, tenantId, body);
      case "list_conversations":
        return jsonResponse({ ok: true, data: await opListConversations(supabase, tenantId) });
      case "get_conversation":
        return jsonResponse({
          ok: true,
          data: await opGetConversation(supabase, tenantId, body),
        });
      default:
        return jsonResponse(
          { ok: false, error: `Nieznana operacja: ${body?.operation}` },
          400,
        );
    }
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonResponse({ ok: false, error: err.message }, err.status);
    }
    return serverErrorResponse("argus-assistant", err);
  }
});
