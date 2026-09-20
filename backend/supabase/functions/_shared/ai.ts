// AI module for Edge Functions (Deno) based on LangChain.
// All AI calls happen EXCLUSIVELY in Edge Functions. The Anthropic API key
// is never exposed to the client (see CLAUDE.md).
//
// LangChain is loaded LAZILY (dynamic import): operations that don't call
// the LLM (e.g. Sejm import steps, embeddings) must not pay its memory cost.
// Edge Function workers have tight resource limits (WORKER_RESOURCE_LIMIT).
import type { ChatAnthropic } from "npm:@langchain/anthropic";
// Prompty sa modulem TS generowanym z plikow .md przez
// backend/scripts/build-prompts.sh: deploy nie bundluje .md.
import { prompts } from "./prompts/index.ts";

// Models per CLAUDE.md: sonnet 5 for generation (briefs, content),
// haiku 4.5 for classification.
const GENERATION_MODEL = "claude-sonnet-5";
const CLASSIFICATION_MODEL = "claude-haiku-4-5";

function getApiKey(): string {
  const key = Deno.env.get("ANTHROPIC_API_KEY") ?? Deno.env.get("CLAUDE_API_KEY");
  if (!key) {
    throw new Error(
      "Missing Anthropic API key: set ANTHROPIC_API_KEY (or CLAUDE_API_KEY) via `supabase secrets set`",
    );
  }
  return key;
}

async function loadChatAnthropic() {
  const mod = await import("npm:@langchain/anthropic");
  return mod.ChatAnthropic;
}

/**
 * Gorny limit odpowiedzi modelu generujacego.
 *
 * Dotad nie bylo go tu wcale, wiec obowiazywal niski domyslny limit
 * @langchain/anthropic. Do czasu, gdy brief przedwywiadowy dostal sekcje
 * o oponencie, wszystko sie w nim miescilo. Potem odpowiedz urywala sie
 * w polowie JSON-a i strukturalne wyjscie konczylo sie "Failed to parse",
 * czyli bledem 500 po 99 sekundach i bez zadnej wskazowki w UI.
 *
 * Limit jest ustawiony jawnie, zeby taki sufit nie byl niewidzialny.
 *
 * 8192 tez okazalo sie za malo: przy szerokim temacie (trzy obszary naraz)
 * model pisze duzo dluzsze sekcje i odpowiedz znowu sie urwala. 16384 daje
 * zapas, ale to JEST podnoszenie sufitu, nie rozwiazanie. Wlasciwe wyjscie to
 * podzial generacji na dwa kroki (jak w argus-content: osobny krok na pytania)
 * i to nalezy zrobic, zanim ten limit trzeba bedzie ruszyc po raz trzeci.
 */
const GENERATION_MAX_TOKENS = 16384;

export interface GenerationOptions {
  /** Nadpisanie limitu odpowiedzi dla wyjatkowo dlugich generacji. */
  maxTokens?: number;
}

// Model for content generation (briefs, message variants, morning brief).
export async function getGenerationModel(
  options: GenerationOptions = {},
): Promise<ChatAnthropic> {
  const Chat = await loadChatAnthropic();
  return new Chat({
    model: GENERATION_MODEL,
    apiKey: getApiKey(),
    maxTokens: options.maxTokens ?? GENERATION_MAX_TOKENS,
  });
}

// Model for cheap classification tasks (topic tagging, routing).
export async function getClassificationModel(): Promise<ChatAnthropic> {
  const Chat = await loadChatAnthropic();
  return new Chat({
    model: CLASSIFICATION_MODEL,
    apiKey: getApiKey(),
  });
}


export function loadPrompt(name: string): string {
  const text = prompts[name];
  if (text === undefined) {
    throw new Error(
      `Nieznany prompt "${name}" — dostepne: ${Object.keys(prompts).join(", ")}. ` +
        "Po dodaniu pliku .md odpal backend/scripts/build-prompts.sh",
    );
  }
  return text;
}
