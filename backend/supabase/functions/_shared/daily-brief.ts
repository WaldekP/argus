// Brief dnia (synteza) — zbieranie materiału + synteza pod strategię polityka.
//
// Dwie ścieżki wejścia (jak przy wzmiankach):
//   - argus-morning-brief (operation `generate`) — user klika "Wygeneruj",
//   - argus-morning-brief przez cron (`x-argus-cron`) — dla wszystkich tenantów.
//
// Źródło materiału (decyzja usera): Bing News (ogólne zapytania polityczne,
// fallback Google) + wystąpienia z Sejmu z danego dnia, jeśli są w bazie.
// Collectory są modularne pod przyszłe źródła (Twitter dorzuci itemy do puli).
//
// Projekt: docs/superpowers/specs/2026-07-26-brief-dnia-synteza-design.md
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "npm:zod";

import { getGenerationModel, loadPrompt } from "./ai.ts";
import { fetchBingNews } from "./bing-news.ts";
import { fetchGoogleNews } from "./google-news.ts";
import { fetchFromSources, type NewsSource } from "./news-sources.ts";

const SOURCES: NewsSource[] = [
  { name: "bing_news", fetch: fetchBingNews },
  { name: "google_news", fetch: fetchGoogleNews },
];

/**
 * Stała, globalna lista zapytań o polską politykę. Instytucje i formacje, nie
 * pojedyncze nazwiska: dzięki temu pula jest szeroka, a wybór, co ważne, robi
 * dopiero synteza pod kątem konkretnego polityka.
 */
export const POLITYKA_QUERIES = [
  "Sejm",
  "rząd premiera",
  "Konfederacja",
  "Trzecia Droga",
  "Koalicja Obywatelska",
  "Prawo i Sprawiedliwość",
  "Nowa Lewica",
  "budżet państwa",
];

/** Okno czasowe dla prasy: ostatnia doba. */
const PRESS_WINDOW_DAYS = 1;
/** Twardy limit pozycji trafiających do promptu (ograniczenie kosztu i workera). */
const MAX_PRESS_ITEMS = 40;
/** Limit wystąpień sejmowych dorzucanych do puli. */
const MAX_SEJM_ITEMS = 15;

/** Pozycja surowej puli materiału. */
export interface RawItem {
  title: string;
  url: string;
  snippet: string | null;
  publishedAt: string | null;
  sourceName: string | null;
  source_type: "press" | "sejm";
}

export interface PressResult {
  items: RawItem[];
  queriesRun: number;
  failures: number;
}

/**
 * Prasa: każde zapytanie osobno, sekwencyjnie (równoległe requesty z jednego
 * adresu to prosta droga do odcięcia — ta sama lekcja co przy wzmiankach).
 * Dedup po URL, najświeższe pierwsze, twardy limit pozycji.
 */
export async function collectPress(): Promise<PressResult> {
  const seen = new Set<string>();
  const items: RawItem[] = [];
  let failures = 0;

  for (const query of POLITYKA_QUERIES) {
    const outcome = await fetchFromSources(SOURCES, query, PRESS_WINDOW_DAYS);
    if (!outcome.source) {
      failures += 1;
      continue;
    }
    for (const item of outcome.items) {
      if (!item.url || seen.has(item.url)) continue;
      seen.add(item.url);
      items.push({
        title: item.title,
        url: item.url,
        snippet: item.snippet,
        publishedAt: item.publishedAt,
        sourceName: item.sourceName,
        source_type: "press",
      });
    }
  }

  items.sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });

  return {
    items: items.slice(0, MAX_PRESS_ITEMS),
    queriesRun: POLITYKA_QUERIES.length,
    failures,
  };
}

/**
 * Sejm: wystąpienia z danej doby, jeśli są już w bazie (tabela zapełniana
 * na żądanie przez feature analiz). Best-effort — brak danych nie jest błędem.
 * Wystąpienia nie mają publicznego URL w naszej bazie, więc trafiają do puli
 * jako kontekst, a nie jako klikalne źródło.
 */
export async function collectSejm(
  supabase: SupabaseClient,
  date: string,
): Promise<RawItem[]> {
  const { data, error } = await supabase
    .from("sejm_statements")
    .select("mp_id, text, date")
    .eq("date", date)
    .limit(MAX_SEJM_ITEMS);

  if (error || !data) return [];

  return data.map((row: { mp_id: number; text: string }) => ({
    title: `Wystąpienie w Sejmie (poseł ${row.mp_id})`,
    url: "",
    snippet: typeof row.text === "string" ? row.text.slice(0, 400) : null,
    publishedAt: date,
    sourceName: "Sejm RP",
    source_type: "sejm" as const,
  }));
}

// ---------------------------------------------------------------------------
// Synteza
// ---------------------------------------------------------------------------

const briefSchema = z.object({
  lead: z.string().describe("Jedno zdanie podsumowujące ton dnia."),
  items: z
    .array(
      z.object({
        kategoria: z.string(),
        naglowek: z.string(),
        streszczenie: z.string(),
        znaczenie_dla_ciebie: z.string(),
        zrodla: z.array(
          z.object({
            tytul: z.string(),
            url: z.string(),
            redakcja: z.string().nullable(),
          }),
        ),
        source_type: z.enum(["press", "sejm"]),
      }),
    )
    .describe("5-7 najważniejszych wydarzeń dnia."),
});

export type BriefItem = z.infer<typeof briefSchema>["items"][number];

interface TenantContext {
  full_name: string | null;
  district: string | null;
  goals: unknown;
  values: unknown;
  boundaries: unknown;
  segments: { name: string; profile: unknown }[];
}

function buildHumanPrompt(ctx: TenantContext, pool: RawItem[]): string {
  const lines = [
    "Polityk, dla którego pracujesz:",
    `Imię i nazwisko: ${ctx.full_name ?? "brak danych"}`,
    `Okręg: ${ctx.district ?? "brak danych"}`,
    "",
    "Cele strategiczne:",
    JSON.stringify(ctx.goals ?? {}, null, 2),
    "",
    "Wartości i osie poglądów:",
    JSON.stringify(ctx.values ?? {}, null, 2),
    "",
    "Granice (czego nie robi, kogo nie atakuje):",
    JSON.stringify(ctx.boundaries ?? {}, null, 2),
    "",
    "Elektoraty docelowe (segmenty):",
    ctx.segments.length > 0
      ? ctx.segments
          .map((s) => `- ${s.name}: ${JSON.stringify(s.profile ?? {})}`)
          .join("\n")
      : "brak zdefiniowanych segmentów",
    "",
    "Surowa pula materiału z ostatniej doby (ponumerowana). Cytuj URL dokładnie:",
  ];

  pool.forEach((item, i) => {
    lines.push(
      `[${i + 1}] (${item.source_type}) ${item.title}`,
      `    źródło: ${item.sourceName ?? "nieznane"}${item.url ? ` | url: ${item.url}` : " | (bez url)"}`,
    );
    if (item.snippet) lines.push(`    treść: ${item.snippet}`);
  });

  lines.push(
    "",
    "Przygotuj przegląd dnia zgodnie z instrukcją systemową: 5-7 wydarzeń, każde z",
    "polami kategoria/naglowek/streszczenie/znaczenie_dla_ciebie/zrodla/source_type.",
  );

  return lines.join("\n");
}

/**
 * Walidacja anty-halucynacyjna: dla wydarzeń prasowych zostawiamy tylko źródła,
 * których URL faktycznie jest w podanej puli. Wydarzenie prasowe bez żadnego
 * prawdziwego URL wypada. Wydarzenia sejmowe (bez URL) przechodzą.
 */
function validateItems(items: BriefItem[], pool: RawItem[]): BriefItem[] {
  const allowed = new Set(pool.map((p) => p.url).filter(Boolean));
  const result: BriefItem[] = [];

  for (const item of items) {
    if (item.source_type === "sejm") {
      result.push(item);
      continue;
    }
    const zrodla = item.zrodla.filter((z) => z.url && allowed.has(z.url));
    if (zrodla.length === 0) continue;
    result.push({ ...item, zrodla });
  }

  return result;
}

async function synthesize(
  ctx: TenantContext,
  pool: RawItem[],
): Promise<z.infer<typeof briefSchema>> {
  if (pool.length === 0) {
    return { lead: "Dziś w monitorowanych źródłach cicho. Brak materiału na przegląd.", items: [] };
  }

  const system = loadPrompt("morning-brief-synthesis");
  const human = buildHumanPrompt(ctx, pool);
  const model = (await getGenerationModel()).withStructuredOutput(briefSchema, {
    name: "morning_brief",
  });

  const result = await model.invoke([
    ["system", system],
    ["human", human],
  ]);

  return {
    lead: result.lead?.trim() ?? "",
    items: validateItems(result.items ?? [], pool),
  };
}

// ---------------------------------------------------------------------------
// Orkiestracja per tenant
// ---------------------------------------------------------------------------

async function loadTenantContext(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<TenantContext> {
  const { data: profile } = await supabase
    .from("politician_profiles")
    .select("full_name, district, goals, values, boundaries")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const { data: segments } = await supabase
    .from("segments")
    .select("name, profile")
    .eq("tenant_id", tenantId);

  return {
    full_name: profile?.full_name ?? null,
    district: profile?.district ?? null,
    goals: profile?.goals ?? null,
    values: profile?.values ?? null,
    boundaries: profile?.boundaries ?? null,
    segments: (segments ?? []) as { name: string; profile: unknown }[],
  };
}

export interface GenerateResult {
  tenant_id: string;
  brief_date: string;
  status: "ready" | "error";
  items: number;
  error: string | null;
}

/** Domyślna doba briefu: dziś w strefie Warszawy (data logiczna, nie UTC). */
export function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });
}

/**
 * Wygeneruj (albo zregeneruj) brief dnia dla jednego tenanta. Idempotentne per
 * (tenant, doba): ponowne wywołanie nadpisuje wiersz. Najpierw zapis statusu
 * `generating`, na końcu `ready`/`error`, żeby UI mogło pokazać stan.
 */
export async function generateForTenant(
  supabase: SupabaseClient,
  tenantId: string,
  briefDate: string = today(),
): Promise<GenerateResult> {
  await supabase.from("daily_briefs").upsert(
    { tenant_id: tenantId, brief_date: briefDate, status: "generating", error: null },
    { onConflict: "tenant_id,brief_date" },
  );

  try {
    const ctx = await loadTenantContext(supabase, tenantId);
    const press = await collectPress();
    const sejm = await collectSejm(supabase, briefDate);
    const pool = [...press.items, ...sejm];

    const brief = await synthesize(ctx, pool);

    await supabase.from("daily_briefs").upsert(
      {
        tenant_id: tenantId,
        brief_date: briefDate,
        status: "ready",
        lead: brief.lead,
        items: brief.items,
        source_stats: {
          press: press.items.length,
          sejm: sejm.length,
          press_queries: press.queriesRun,
          press_failures: press.failures,
        },
        model: "claude-sonnet-5",
        error: null,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,brief_date" },
    );

    return {
      tenant_id: tenantId,
      brief_date: briefDate,
      status: "ready",
      items: brief.items.length,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase.from("daily_briefs").upsert(
      { tenant_id: tenantId, brief_date: briefDate, status: "error", error: message },
      { onConflict: "tenant_id,brief_date" },
    );
    return {
      tenant_id: tenantId,
      brief_date: briefDate,
      status: "error",
      items: 0,
      error: message,
    };
  }
}

// ---------------------------------------------------------------------------
// Pomysły na tweety (X) z briefu dnia — efemeryczne, bez zapisu do bazy.
// To pomysły (temat + w co uderzyć), nie gotowe wpisy: gotowy tweet pisze
// człowiek, tu dostaje kąt i punkt zapalny.
// ---------------------------------------------------------------------------

const tweetsSchema = z.object({
  tweets: z
    .array(
      z.object({
        wydarzenie: z.string().describe("Etykieta wydarzenia z przeglądu."),
        temat: z.string().describe("O czym miałby być wpis: teza albo hasło."),
        w_co_uderzyc: z
          .string()
          .describe("Punkt zapalny i kąt uderzenia, 1-2 zdania."),
      }),
    )
    .describe("Około 5 zróżnicowanych pomysłów na wpisy."),
});

export type TweetIdea = z.infer<typeof tweetsSchema>["tweets"][number];

/**
 * Pomysły na tweety z dzisiejszego (albo wskazanego) briefu dnia. Bierze
 * gotowe wydarzenia z `daily_briefs` i profil polityka, zwraca pomysły:
 * o czym napisać i w co uderzyć. Nic nie zapisuje.
 */
export async function generateTweetsForTenant(
  supabase: SupabaseClient,
  tenantId: string,
  briefDate: string = today(),
): Promise<{ tweets: TweetIdea[]; brief_date: string }> {
  const { data: brief } = await supabase
    .from("daily_briefs")
    .select("items, status")
    .eq("tenant_id", tenantId)
    .eq("brief_date", briefDate)
    .maybeSingle();

  const items = (brief?.items ?? []) as BriefItem[];
  if (!brief || brief.status !== "ready" || items.length === 0) {
    return { tweets: [], brief_date: briefDate };
  }

  const { data: profile } = await supabase
    .from("politician_profiles")
    .select("full_name, style_profile, values, boundaries")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const human = [
    `Polityk: ${profile?.full_name ?? "brak danych"}`,
    "",
    "Profil stylu językowego (naśladuj):",
    JSON.stringify(profile?.style_profile ?? {}, null, 2),
    "",
    "Wartości i osie poglądów:",
    JSON.stringify(profile?.values ?? {}, null, 2),
    "",
    "Granice (czego nie robi, kogo nie atakuje):",
    JSON.stringify(profile?.boundaries ?? {}, null, 2),
    "",
    "Przegląd dnia (wydarzenia, na które można zareagować):",
    ...items.map(
      (it, i) =>
        `[${i + 1}] ${it.naglowek}\n    ${it.streszczenie}\n    kąt strategiczny: ${it.znaczenie_dla_ciebie}`,
    ),
    "",
    "Zaproponuj około 5 zróżnicowanych wpisów na X zgodnie z instrukcją systemową.",
  ].join("\n");

  const system = loadPrompt("morning-brief-tweets");
  const model = (await getGenerationModel()).withStructuredOutput(tweetsSchema, {
    name: "brief_tweets",
  });

  const result = await model.invoke([
    ["system", system],
    ["human", human],
  ]);

  return { tweets: result.tweets ?? [], brief_date: briefDate };
}

/**
 * Przebieg cronowy: brief na dziś dla wszystkich tenantów, które mają profil.
 * Sekwencyjnie — każdy tenant to osobne pobranie prasy i wywołanie Sonnet.
 */
export async function generateForAllTenants(
  supabase: SupabaseClient,
  briefDate: string = today(),
): Promise<GenerateResult[]> {
  const { data, error } = await supabase.from("politician_profiles").select("tenant_id");
  if (error) throw new Error(error.message);

  const results: GenerateResult[] = [];
  for (const row of (data ?? []) as { tenant_id: string }[]) {
    results.push(await generateForTenant(supabase, row.tenant_id, briefDate));
  }
  return results;
}
