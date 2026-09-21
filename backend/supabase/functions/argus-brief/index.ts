// argus-brief — brief przedwywiadowy (TASK 5, serce MVP).
// Operacje: create, get, list, rate, question_feedback.
//
// Wejscie to formularz "gdzie / kto prowadzi / kto jeszcze / temat". "Gdzie"
// to program z tabeli `programs`, ktory sam podpowiada prowadzacego i ostatnie
// tematy pasma; "kto jeszcze" to obsada (oponenci, wspolgoscie), dla poslow
// wzbogacona dossier z rejestru sond (_shared/probes/). Wyjscie: profil rozmowcy,
// publicznosc, 10 przewidywanych pytan z prawdopodobienstwem i rekomendowana
// odpowiedzia, pulapki z mostami oraz 3 przekazy dnia.
//
// Skad bierzemy kontekst (retrieve):
//   - profil polityka: wartosci, granice, profil stylu (tenant),
//   - dziennikarz i redakcja z bazy globalnej + jego ostatnie materialy,
//   - wlasne wypowiedzi sejmowe dopasowane do tematu (embedding + match_statements),
//   - badania opinii CBOS dopasowane do tematu (knowledge-search, fail-soft),
//   - dzisiejszy przeglad dnia, zeby brief znal biezace wydarzenia,
//   - program: prowadzacy, pasmo i osiem ostatnich odcinkow z goscmi,
//   - obsada: dossier oponenta z rejestru sond (glosowania, rozjazdy z klubem,
//     wystapienia, wejscia do programow) razem z jawna lista luk.
//
// Migracja 20260918100000 dolozyla `program_id` i `participants`
// do interview_briefs; reszta schematu pochodzi z migracji 001.
//
// Zasoby workera: generacja to DWA wywolania Sonneta ze strukturalnym wyjsciem
// (rdzen i osobno pytania), bo jedno przestalo sie miescic przy temacie
// zlozonym z kilku watkow. Szczegoly przy briefCoreSchema nizej.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "npm:zod";
import { authenticateRequest, getTenantId, HttpError } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse, serverErrorResponse } from "../_shared/types.ts";
import { getGenerationModel, loadPrompt } from "../_shared/ai.ts";
import { embedText } from "../_shared/embeddings.ts";
import { searchOpinionContext } from "../_shared/knowledge-search.ts";
import { today } from "../_shared/date.ts";
import { runProbeSet } from "../_shared/probes/registry.ts";
import { makeWindow } from "../_shared/probes/types.ts";

const TOPIC_MIN_LENGTH = 5;

/**
 * Identyfikator briefu z ciala zadania.
 *
 * Bez sprawdzenia ksztaltu Postgres odrzuca zapytanie bledem skladni UUID,
 * ten leci przez serverErrorResponse i uzytkownik dostaje 500 z numerem
 * zgloszenia zamiast informacji, ze link jest nieprawidlowy. Zdarza sie
 * przy starym albo przycietym linku, wiec nie jest to przypadek teoretyczny.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readBriefId(value: unknown): string {
  const id = typeof value === "string" ? value.trim() : "";
  if (id === "") throw new HttpError(400, "Brak identyfikatora briefu.");
  if (!UUID_RE.test(id)) throw new HttpError(404, "Nie znaleziono briefu.");
  return id;
}
const QUESTIONS_COUNT = 10;
const STATEMENTS_LIMIT = 8;
const MATERIALS_LIMIT = 12;
const LIST_LIMIT = 50;

// ---------------------------------------------------------------------------
// Ksztalt odpowiedzi modelu
// ---------------------------------------------------------------------------

const briefSchema = z.object({
  profil_rozmowcy: z.string(),
  // Pole jest zawsze wymagane, a przy rozmowie jeden na jeden model wpisuje
  // zdanie o braku drugiego gościa. Pole opcjonalne w strukturalnym wyjściu
  // bywa pomijane losowo, a UI i tak ukrywa sekcję po pustej obsadzie.
  profil_oponenta: z.string(),
  publicznosc: z.string(),
  pytania: z.array(
    z.object({
      pytanie: z.string(),
      prawdopodobienstwo: z.number().min(0).max(1),
      teza: z.string(),
      punkty: z.array(z.string()),
      ryzyko: z.string(),
    }),
  ),
  pulapki: z.array(
    z.object({
      pulapka: z.string(),
      most: z.string(),
    }),
  ),
  przekazy_dnia: z.array(z.string()),
});

type BriefContent = z.infer<typeof briefSchema>;

/**
 * Brief powstaje w DWOCH wywolaniach modelu, nie w jednym.
 *
 * Powod jest zmierzony, nie teoretyczny. 21 wrzesnia polityk wpisal cztery
 * watki naraz ("ceny paliw, Berek do TK, bezpieczenstwo, pakiety fundacji"),
 * bo tak wlasnie wyglada prawdziwa rozmowa w studiu. Odpowiedz na taki temat
 * nie miescila sie w jednym wywolaniu i urywala sie w polowie JSON-a, a
 * uzytkownik dostawal 500 z numerem zgloszenia. Podnoszenie limitu tokenow
 * nie pomoglo: powyzej pewnej wartosci SDK Anthropica w ogole odmawia
 * wywolania nieblokowanego.
 *
 * Dlatego dzielimy odpowiedz na polowy, kazda z wlasnym schematem. Zadna
 * z nich nie zbliza sie do sufitu, a wejscie (ten sam material) jest wspolne.
 */
const briefCoreSchema = briefSchema.omit({ pytania: true });
const briefQuestionsSchema = briefSchema.pick({ pytania: true });

// ---------------------------------------------------------------------------
// Retrieve
// ---------------------------------------------------------------------------

async function getProfile(supabase: SupabaseClient, tenantId: string) {
  const { data, error } = await supabase
    .from("politician_profiles")
    .select("full_name, district, goals, values, boundaries, style_profile, topic_positions")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(`Odczyt profilu: ${error.message}`);
  return data;
}

async function getJournalist(supabase: SupabaseClient, journalistId: string) {
  // UWAGA: lista kolumn musi byc JEDNYM literalem (patrz argus-media) — string
  // sklejany plusem traci typ literalny i parser supabase-js sie poddaje.
  const { data, error } = await supabase
    .from("journalists")
    .select(
      "id, full_name, role, bio, topics, style_profile, playbook, takedown_requested, outlet_id, outlets ( name, type, editorial_line, audience_profile )",
    )
    .eq("id", journalistId)
    .maybeSingle();
  if (error) throw new Error(`Odczyt dziennikarza: ${error.message}`);
  if (data?.takedown_requested) {
    throw new HttpError(404, "Ten profil dziennikarza został wycofany z bazy.");
  }
  return data;
}

async function getMaterials(supabase: SupabaseClient, journalistId: string) {
  const { data } = await supabase
    .from("journalist_materials")
    .select("title, url, published_at, summary")
    .eq("journalist_id", journalistId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(MATERIALS_LIMIT);
  return data ?? [];
}

/** Wlasne wypowiedzi dopasowane do tematu. Fail-soft: brak to nie awaria. */
async function getOwnStatements(
  supabase: SupabaseClient,
  tenantId: string,
  topic: string,
): Promise<{ text: string; date: string | null }[]> {
  try {
    const embedding = await embedText(topic);
    const { data } = await supabase.rpc("match_statements", {
      p_tenant_id: tenantId,
      p_query_embedding: embedding,
      p_limit: STATEMENTS_LIMIT,
    });
    return (data ?? []) as { text: string; date: string | null }[];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Program i obsada
// ---------------------------------------------------------------------------

/** Ile ostatnich odcinków programu wchodzi do promptu. */
const EPISODES_LIMIT = 5;
/**
 * Ile pozycji z dossier oponenta przekazujemy.
 *
 * Im więcej materiału wejściowego, tym dłuższe sekcje pisze model, a długa
 * odpowiedź przestaje się mieścić w limicie i cała generacja pada. Cztery
 * pozycje z cytatem po 320 znaków wystarczają, żeby brief miał czym poprzeć
 * tezę, i nie prowokują modelu do wypracowania.
 */
const OPPONENT_ITEMS = 4;
const OPPONENT_QUOTE_CHARS = 320;

interface ProgramRow {
  id: string;
  name: string;
  hosts: string[] | null;
  schedule_note: string | null;
  outlet_id: string | null;
  outlets: { name: string } | { name: string }[] | null;
}

async function getProgram(supabase: SupabaseClient, slug: string) {
  // UWAGA: lista kolumn musi byc JEDNYM literalem (patrz argus-media).
  const { data, error } = await supabase
    .from("programs")
    .select("id, name, hosts, schedule_note, outlet_id, outlets ( name )")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Odczyt programu: ${error.message}`);
  return (data ?? null) as ProgramRow | null;
}

async function getProgramEpisodes(supabase: SupabaseClient, programId: string) {
  const { data } = await supabase
    .from("program_episodes")
    .select("title, guests, published_at")
    .eq("program_id", programId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(EPISODES_LIMIT);
  return (data ?? []) as { title: string; guests: string[] | null; published_at: string | null }[];
}

/** Uczestnik rozmowy poza prowadzącym (kształt kolumny `participants`). */
interface Participant {
  role: "opponent" | "guest";
  kind: "mp" | "person";
  mp_id?: number;
  name: string;
  club?: string | null;
}

function parseParticipants(raw: unknown): Participant[] {
  if (!Array.isArray(raw)) return [];
  const out: Participant[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const row = item as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (name === "") continue;
    const mpId = typeof row.mp_id === "number" ? Math.trunc(row.mp_id) : undefined;
    out.push({
      role: row.role === "guest" ? "guest" : "opponent",
      kind: mpId ? "mp" : "person",
      mp_id: mpId,
      name,
      club: typeof row.club === "string" ? row.club : null,
    });
    if (out.length >= 3) break; // panel powyżej czwórki to już nie wywiad
  }
  return out;
}

/**
 * Dossier oponenta z rejestru sond.
 *
 * Fail-soft w dwóch warstwach: `runProbeSet` łapie awarie pojedynczych sond,
 * a tu łapiemy awarię całości. Brak dossier ma dać brief bez sekcji o oponencie,
 * a nie brak briefu.
 */
async function getOpponentContext(
  supabase: SupabaseClient,
  participants: Participant[],
): Promise<string> {
  const blocks: string[] = [];
  for (const person of participants) {
    if (person.kind !== "mp" || !person.mp_id) {
      blocks.push(
        `## ${person.name}\n(Osoba spoza Sejmu. Brak danych w bazie, nie zmyslaj jego pogladow ani cytatow.)`,
      );
      continue;
    }
    try {
      const dossier = await runProbeSet(
        { supabase },
        "karta-posla",
        { kind: "mp", id: person.mp_id, name: person.name, club: person.club ?? null },
        makeWindow(6),
      );
      const lines: string[] = [`## ${person.name}`];
      for (const result of dossier.results) {
        if (Object.keys(result.summary).length > 0) {
          lines.push(`### ${result.label} (dane)\n${JSON.stringify(result.summary)}`);
        }
        if (result.findings.length > 0) {
          lines.push(
            `### ${result.label}\n` +
              result.findings
                .slice(0, OPPONENT_ITEMS)
                .map((f) => {
                  const quote = f.evidence[0]?.quote;
                  const date = f.evidence[0]?.date ?? "bez daty";
                  return `- [${date}] ${f.title}${quote ? `\n  cytat: ${quote.slice(0, 500)}` : ""}`;
                })
                .join("\n"),
          );
        }
        if (result.coverage.gaps.length > 0) {
          lines.push(`### ${result.label} (czego nie wiemy)\n- ${result.coverage.gaps.join("\n- ")}`);
        }
      }
      blocks.push(lines.join("\n"));
    } catch {
      blocks.push(`## ${person.name}\n(Nie udalo sie zebrac danych. Nie zmyslaj ich.)`);
    }
  }
  return blocks.join("\n\n");
}

/**
 * Dzisiejszy przeglad dnia, zeby brief nie byl oderwany od biezacych wydarzen.
 *
 * Date bierzemy z `today()` (Europe/Warsaw), tak jak reszta briefu dnia. Wlasne
 * liczenie przez toISOString dawalo date UTC, wiec miedzy polnoca a druga w nocy
 * czasu polskiego siegalo po wczorajszy wiersz.
 */
async function getTodayBrief(supabase: SupabaseClient, tenantId: string): Promise<string> {
  const { data } = await supabase
    .from("daily_briefs")
    .select("items, status")
    .eq("tenant_id", tenantId)
    .eq("brief_date", today())
    .maybeSingle();
  if (!data || data.status !== "ready" || !Array.isArray(data.items)) return "";
  const items = data.items as { naglowek?: string; streszczenie?: string }[];
  return items
    .slice(0, 6)
    .map((i) => `- ${i.naglowek ?? ""}: ${i.streszczenie ?? ""}`.trim())
    .join("\n");
}

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------

function opis(wartosc: unknown): string {
  if (wartosc === null || wartosc === undefined) return "brak danych";
  if (typeof wartosc === "string") return wartosc.trim() || "brak danych";
  return JSON.stringify(wartosc);
}

interface GenerateInput {
  topic: string;
  scheduledAt: string | null;
  profile: Record<string, unknown> | null;
  journalist: Record<string, unknown> | null;
  journalistName: string | null;
  materials: { title: string; published_at: string | null }[];
  statements: { text: string; date: string | null }[];
  opinion: string;
  dayBrief: string;
  program: ProgramRow | null;
  episodes: { title: string; guests: string[] | null; published_at: string | null }[];
  participants: Participant[];
  opponentContext: string;
}

function buildHuman(input: GenerateInput, zadanie: string): string {
  const outlet = (input.journalist?.outlets ?? null) as Record<string, unknown> | null;
  const dziennikarz = input.journalist
    ? [
      `Imie i nazwisko: ${opis(input.journalist.full_name)}`,
      `Rola: ${opis(input.journalist.role)}`,
      `Bio: ${opis(input.journalist.bio)}`,
      `Tematy: ${Array.isArray(input.journalist.topics) ? input.journalist.topics.join(", ") : "brak danych"}`,
      `Profil stylu: ${opis(input.journalist.style_profile)}`,
      `Playbook: ${opis(input.journalist.playbook)}`,
    ].join("\n")
    : `Imie i nazwisko: ${opis(input.journalistName)}\n(Brak profilu w bazie. Nie zmyslaj stylu ani playbooku, napisz wprost, czego nie wiadomo.)`;

  const redakcja = outlet
    ? [
      `Nazwa: ${opis(outlet.name)}`,
      `Typ: ${opis(outlet.type)}`,
      `Linia redakcyjna: ${opis(outlet.editorial_line)}`,
      `Publicznosc: ${opis(outlet.audience_profile)}`,
    ].join("\n")
    : "brak danych";

  const materialy = input.materials.length > 0
    ? input.materials
      .map((m) => `- ${m.published_at?.slice(0, 10) ?? "bez daty"}: ${m.title}`)
      .join("\n")
    : "brak danych";

  const wypowiedzi = input.statements.length > 0
    ? input.statements
      .map((s) => `- ${s.date?.slice(0, 10) ?? "bez daty"}: ${s.text.slice(0, 500)}`)
      .join("\n")
    : "brak danych";

  const programOutlets = input.program ? input.program.outlets : null;
  const programOutlet = Array.isArray(programOutlets) ? programOutlets[0] : programOutlets;
  const program = input.program
    ? [
      `Nazwa: ${input.program.name}`,
      `Nadawca: ${opis(programOutlet?.name)}`,
      `Pasmo: ${opis(input.program.schedule_note)}`,
      `Prowadzacy: ${
        Array.isArray(input.program.hosts) && input.program.hosts.length > 0
          ? input.program.hosts.join(", ")
          : "brak danych"
      }`,
    ].join("\n")
    : "brak danych";

  // Ostatnie odcinki niosa dwie rzeczy naraz: o co redakcja pyta w tym
  // tygodniu i jak ustawia rozmowe z politykiem danej formacji.
  const odcinki = input.episodes.length > 0
    ? input.episodes
      .map((e) => {
        const guests = Array.isArray(e.guests) && e.guests.length > 0
          ? e.guests.join(", ")
          : "brak danych o gosciach";
        return `- ${e.published_at?.slice(0, 10) ?? "bez daty"} (${guests}): ${e.title}`;
      })
      .join("\n")
    : "brak danych";

  const obsada = input.participants.length > 0
    ? input.participants
      .map((p) =>
        `- ${p.name}${p.club ? ` (${p.club})` : ""}, rola: ${
          p.role === "opponent" ? "oponent" : "wspolgosc"
        }`
      )
      .join("\n")
    : "brak, rozmowa jeden na jeden z prowadzacym";

  return [
    `# Temat rozmowy\n${input.topic}`,
    input.scheduledAt ? `# Termin\n${input.scheduledAt}` : "",
    `# Program\n${program}`,
    input.episodes.length > 0 ? `# Ostatnie odcinki tego programu\n${odcinki}` : "",
    `# Obsada rozmowy poza prowadzacym\n${obsada}`,
    input.opponentContext ? `# Co wiemy o osobach naprzeciwko\n${input.opponentContext}` : "",
    `# Polityk\nImie i nazwisko: ${opis(input.profile?.full_name)}\nOkreg: ${opis(input.profile?.district)}\nCele: ${opis(input.profile?.goals)}\nWartosci: ${opis(input.profile?.values)}\nGranice (nienaruszalne): ${opis(input.profile?.boundaries)}
Stanowiska wobec tematow: ${opis(input.profile?.topic_positions)}\nProfil stylu jezykowego: ${opis(input.profile?.style_profile)}`,
    `# Dziennikarz\n${dziennikarz}`,
    `# Redakcja\n${redakcja}`,
    `# Ostatnie materialy dziennikarza\n${materialy}`,
    `# Wlasne wypowiedzi polityka dopasowane do tematu\n${wypowiedzi}`,
    input.opinion ? `# Badania opinii publicznej\n${input.opinion}` : "",
    input.dayBrief ? `# Dzisiejszy przeglad dnia\n${input.dayBrief}` : "",
    `# Zadanie\nPrzygotuj brief przedwywiadowy. Dokladnie ${QUESTIONS_COUNT} pytan, 3 przekazy dnia.`,
  ].filter((s) => s !== "").join("\n\n");
}

async function generateBrief(input: GenerateInput): Promise<BriefContent> {
  const model = await getGenerationModel();
  const system = loadPrompt("interview-brief");

  // Krok 1: wszystko poza pytaniami.
  const core = await model
    .withStructuredOutput(briefCoreSchema, { name: "brief_rdzen" })
    .invoke([
      ["system", system],
      [
        "human",
        buildHuman(
          input,
          "Przygotuj WYLACZNIE: profil_rozmowcy, profil_oponenta, publicznosc, " +
            "pulapki oraz przekazy_dnia. Pytan NIE pisz w tym kroku, powstana osobno.",
        ),
      ],
    ]);

  // Krok 2: same pytania, na tym samym materiale.
  const questions = await model
    .withStructuredOutput(briefQuestionsSchema, { name: "brief_pytania" })
    .invoke([
      ["system", system],
      [
        "human",
        buildHuman(
          input,
          `Przygotuj WYLACZNIE ${QUESTIONS_COUNT} przewidywanych pytan, uszeregowanych ` +
            "od najbardziej prawdopodobnego. Nie pisz profili, pulapek ani przekazow dnia.",
        ),
      ],
    ]);

  return { ...core, ...questions } as BriefContent;
}

// ---------------------------------------------------------------------------
// Operacje
// ---------------------------------------------------------------------------

async function opCreate(
  supabase: SupabaseClient,
  tenantId: string,
  body: Record<string, unknown>,
) {
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (topic.length < TOPIC_MIN_LENGTH) {
    throw new HttpError(400, `Temat jest za krótki (min ${TOPIC_MIN_LENGTH} znaków).`);
  }
  const journalistId = typeof body.journalist_id === "string" ? body.journalist_id : null;
  const scheduledAt = typeof body.scheduled_at === "string" ? body.scheduled_at : null;
  const participants = parseParticipants(body.participants);

  const programSlug = typeof body.program_slug === "string" ? body.program_slug.trim() : "";
  const program = programSlug ? await getProgram(supabase, programSlug) : null;

  // Prowadzacego bierzemy z programu, gdy user go nie wskazal. To usuwa
  // pulapke z imiennikami: w bazie dziennikarzy jest Magdalena Olejnik,
  // a Kropke nad i prowadzi Monika, wiec wybor z listy budowal profil innej
  // osoby i nic nie ostrzegalo.
  const hostFromProgram = program && Array.isArray(program.hosts) && program.hosts.length > 0
    ? program.hosts[0]
    : null;
  const journalistName = typeof body.journalist_name === "string" && body.journalist_name.trim()
    ? body.journalist_name.trim()
    : journalistId
    ? null
    : hostFromProgram;

  const journalist = journalistId ? await getJournalist(supabase, journalistId) : null;
  // Trzy zrodla redakcji, po kolei. Jawne kroki zamiast lancucha `??`, bo
  // Deno zglasza na nim TS2871 (wyrazenie zawsze nullowe), a `tsc` na `src/`
  // tego nie widzi: typy backendu sprawdza wylacznie CI.
  let outletId: string | null = null;
  const journalistOutlet = journalist?.outlet_id;
  if (typeof journalistOutlet === "string") outletId = journalistOutlet;
  if (outletId === null && program && typeof program.outlet_id === "string") {
    outletId = program.outlet_id;
  }
  if (outletId === null && typeof body.outlet_id === "string") outletId = body.outlet_id;

  const { data: created, error: insertError } = await supabase
    .from("interview_briefs")
    .insert({
      tenant_id: tenantId,
      topic,
      journalist_id: journalistId,
      outlet_id: outletId,
      program_id: program?.id ?? null,
      participants,
      scheduled_at: scheduledAt,
      status: "generating",
    })
    .select("id")
    .single();
  if (insertError) throw new Error(`Zapis briefu: ${insertError.message}`);
  const briefId = created.id as string;

  try {
    const [profile, materials, statements, opinion, dayBrief, episodes, opponentContext] =
      await Promise.all([
        getProfile(supabase, tenantId),
        journalistId ? getMaterials(supabase, journalistId) : Promise.resolve([]),
        getOwnStatements(supabase, tenantId, topic),
        searchOpinionContext(supabase, topic),
        getTodayBrief(supabase, tenantId),
        program ? getProgramEpisodes(supabase, program.id) : Promise.resolve([]),
        getOpponentContext(supabase, participants),
      ]);

    const content = await generateBrief({
      topic,
      scheduledAt,
      profile: profile as Record<string, unknown> | null,
      journalist: journalist as Record<string, unknown> | null,
      journalistName,
      materials: materials as { title: string; published_at: string | null }[],
      statements,
      opinion,
      dayBrief,
      program,
      episodes,
      participants,
      opponentContext,
    });

    await supabase
      .from("interview_briefs")
      .update({ status: "ready", content })
      .eq("tenant_id", tenantId)
      .eq("id", briefId);

    // Pytania ida takze do osobnej tabeli: to na nich wisi feedback po wywiadzie
    // (was_asked) i to one, a nie caly jsonb, sa jednostka oceny.
    const rows = content.pytania.map((p) => ({
      tenant_id: tenantId,
      brief_id: briefId,
      question: p.pytanie,
      probability: p.prawdopodobienstwo,
      recommended_answer: { teza: p.teza, punkty: p.punkty, ryzyko: p.ryzyko },
    }));
    if (rows.length > 0) {
      const { error } = await supabase.from("brief_questions").insert(rows);
      if (error) throw new Error(`Zapis pytan: ${error.message}`);
    }

    return await readBrief(supabase, tenantId, briefId);
  } catch (err) {
    await supabase
      .from("interview_briefs")
      .update({ status: "error" })
      .eq("tenant_id", tenantId)
      .eq("id", briefId);
    throw err;
  }
}

async function readBrief(supabase: SupabaseClient, tenantId: string, briefId: string) {
  const { data, error } = await supabase
    .from("interview_briefs")
    .select(
      "id, topic, status, content, rating, feedback, scheduled_at, created_at, journalist_id, participants, program_id, journalists ( full_name, role, outlets ( name ) ), programs ( name, slug, hosts, schedule_note )",
    )
    .eq("tenant_id", tenantId)
    .eq("id", briefId)
    .maybeSingle();
  if (error) throw new Error(`Odczyt briefu: ${error.message}`);
  if (!data) throw new HttpError(404, "Nie znaleziono briefu.");

  const { data: questions } = await supabase
    .from("brief_questions")
    .select("id, question, probability, recommended_answer, was_asked")
    .eq("tenant_id", tenantId)
    .eq("brief_id", briefId)
    .order("probability", { ascending: false, nullsFirst: false });

  return { brief: data, questions: questions ?? [] };
}

async function opList(supabase: SupabaseClient, tenantId: string) {
  const { data, error } = await supabase
    .from("interview_briefs")
    .select(
      "id, topic, status, rating, scheduled_at, created_at, participants, journalists ( full_name, outlets ( name ) ), programs ( name, slug )",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw new Error(`Lista briefow: ${error.message}`);
  return { briefs: data ?? [] };
}

async function opRate(
  supabase: SupabaseClient,
  tenantId: string,
  body: Record<string, unknown>,
) {
  const briefId = readBriefId(body.brief_id);
  const rating = typeof body.rating === "number" ? Math.trunc(body.rating) : 0;
  if (rating < 1 || rating > 5) throw new HttpError(400, "Ocena musi być od 1 do 5.");
  const feedback = typeof body.feedback === "string" ? body.feedback : null;

  const { error } = await supabase
    .from("interview_briefs")
    .update({ rating, feedback })
    .eq("tenant_id", tenantId)
    .eq("id", briefId);
  if (error) throw new Error(`Zapis oceny: ${error.message}`);
  return { rated: true };
}

async function opQuestionFeedback(
  supabase: SupabaseClient,
  tenantId: string,
  body: Record<string, unknown>,
) {
  const questionId = typeof body.question_id === "string" ? body.question_id.trim() : "";
  if (questionId === "" || !UUID_RE.test(questionId)) {
    throw new HttpError(400, "Nieprawidłowy identyfikator pytania.");
  }
  const wasAsked = body.was_asked === true;

  const { error } = await supabase
    .from("brief_questions")
    .update({ was_asked: wasAsked })
    .eq("tenant_id", tenantId)
    .eq("id", questionId);
  if (error) throw new Error(`Zapis oznaczenia pytania: ${error.message}`);
  return { saved: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, user } = await authenticateRequest(req);
    const tenantId = await getTenantId(supabase, user.id);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    switch (body?.operation) {
      case "create":
        return jsonResponse({ ok: true, data: await opCreate(supabase, tenantId, body) });
      case "get": {
        const briefId = readBriefId(body.brief_id);
        return jsonResponse({ ok: true, data: await readBrief(supabase, tenantId, briefId) });
      }
      case "list":
        return jsonResponse({ ok: true, data: await opList(supabase, tenantId) });
      case "rate":
        return jsonResponse({ ok: true, data: await opRate(supabase, tenantId, body) });
      case "question_feedback":
        return jsonResponse({
          ok: true,
          data: await opQuestionFeedback(supabase, tenantId, body),
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
    return serverErrorResponse("argus-brief", err);
  }
});
