/**
 * Teczka oponenta: przebiegi z wyszukiwaniem w sieci (web search API Claude).
 *
 * Jeden przebieg = jedno wywołanie modelu z narzędziem serwerowym web search,
 * kilka wyszukiwań na jeden aspekt (wywiady, kontrowersje, media
 * społecznościowe, program partii, późniejsze fakty). Na końcu synteza bez
 * wyszukiwania. Podział na przebiegi wynika z limitu czasu workera Edge
 * Functions: całość trwa kilka minut, jeden przebieg mieści się w dwóch.
 *
 * Koszt: wyszukiwanie to 10 USD za 1000 zapytań, czyli ok. 0,30 USD na teczkę
 * przy sześciu przebiegach po pięć wyszukiwań, plus tokeny wyników wpadające
 * na wejście modelu. Razem ok. 1-2 USD (decyzja usera 2026-10-08).
 *
 * Pomiar z 8 października (Michał Wawer, przebieg „kontrowersje"):
 *   - `web_search_20260209` (dynamiczne filtrowanie): ponad 300 s, nie do użycia
 *     w workerze, bo pod spodem odpala wykonywanie kodu na wynikach,
 *   - `web_search_20250305`, effort low: 34 s, ale tylko 3 pozycje,
 *   - `web_search_20250305`, effort medium: 50-57 s, 5-10 pozycji,
 *     zero pozycji odrzuconych za źródło spoza wyników.
 * Stąd podstawowe narzędzie i effort medium. Szerokość teczki bierzemy z liczby
 * przebiegów, nie z liczby wyszukiwań w jednym, bo przebieg musi zmieścić się
 * w limicie czasu workera.
 */

import { GENERATION_MODEL, getAnthropicClient, loadPrompt } from "./ai.ts";
import {
  type DossierItem,
  type DossierSource,
  extractJson,
} from "./opponent-dossier.ts";

export interface DossierSubject {
  full_name: string;
  role_hint: string | null;
  party: string | null;
  notes: string | null;
}

export interface PassDefinition {
  id: string;
  label: string;
  /** Liczba wyszukiwań w przebiegu (`max_uses` narzędzia). 0 = bez sieci. */
  searches: number;
  focus: (subject: DossierSubject) => string;
}

export const PASSES: PassDefinition[] = [
  {
    id: "wywiady",
    label: "Wywiady w radiu i telewizji",
    searches: 5,
    focus: () =>
      "Wywiady i rozmowy w radiu i telewizji (RMF FM, Radio ZET, TVN24, Polsat News, " +
      "TVP Info, Republika, Radio Wnet i inne), relacje z nich w portalach. Szukaj " +
      "wypowiedzi o gospodarce, podatkach, państwie, bezpieczeństwie, własnej partii " +
      "i przeciwnikach. Zbierz możliwie szeroki przekrój tematów.",
  },
  {
    id: "prasa",
    label: "Prasa, portale i podcasty",
    searches: 5,
    focus: () =>
      "Wywiady prasowe i portalowe (Rzeczpospolita, Gazeta Wyborcza, Do Rzeczy, Sieci, " +
      "Onet, Wirtualna Polska, Interia, money.pl, Business Insider), podcasty i kanały " +
      "wideo, konferencje prasowe. Szukaj tematów innych niż w wywiadach radiowych " +
      "i telewizyjnych.",
  },
  {
    id: "kontrowersje",
    label: "Kontrowersje i wpadki",
    searches: 5,
    focus: () =>
      "Wypowiedzi, które wywołały krytykę, burzę medialną, sprostowania, przeprosiny " +
      "albo pozwy. Sprawdź serwisy fact-checkingowe (Demagog, Konkret24, OKO.press) " +
      "i hasła typu „kontrowersyjna wypowiedź”, „burza po słowach”, „przeprosił”.",
  },
  {
    id: "spolecznosciowe",
    label: "Media społecznościowe",
    searches: 4,
    focus: () =>
      "Wpisy na X (Twitter), Facebooku i w nagraniach wideo, które opisały media. " +
      "Bierz relację medialną jako źródło, bo nie masz dostępu do samych platform.",
  },
  {
    id: "program",
    label: "Program partii i zmiany zdania",
    searches: 5,
    focus: (s) =>
      `Program i oficjalne stanowiska partii ${s.party ?? "tej osoby"}. Szukaj ` +
      "wypowiedzi sprzecznych z programem, z linią partii, z głosowaniami jej klubu " +
      "i z wcześniejszymi wypowiedziami tej samej osoby (zmiany zdania).",
  },
  {
    id: "fakty",
    label: "Co wydarzyło się później",
    searches: 5,
    focus: () =>
      "Dla zebranych prognoz, obietnic i twierdzeń sprawdź, co wydarzyło się później: " +
      "dane, decyzje, wydarzenia, które je podważyły albo potwierdziły. Uzupełniaj " +
      "pole `updates`. Nowe pozycje dodawaj tylko, gdy przy okazji trafisz na istotną wypowiedź.",
  },
  {
    id: "synteza",
    label: "Podsumowanie",
    searches: 0,
    focus: () => "",
  },
];

export interface PassOutput {
  rawItems: unknown;
  rawUpdates: unknown;
  notes: string;
  sources: DossierSource[];
  searchCount: number;
}

function describeSubject(s: DossierSubject): string {
  return [
    `Imię i nazwisko: ${s.full_name}`,
    `Funkcja / rola: ${s.role_hint || "nie podano"}`,
    `Partia / klub: ${s.party || "nie podano"}`,
    `Wskazówki do identyfikacji: ${s.notes || "brak"}`,
  ].join("\n");
}

function knownItemsList(items: DossierItem[], withQuotes: boolean): string {
  if (items.length === 0) return "(brak, to pierwszy przebieg)";
  return items
    .map((i) =>
      withQuotes
        ? `- ${i.id} [${i.date ?? "bez daty"}] (${i.category}) ${i.quote.slice(0, 220)}`
        : `- [${i.date ?? "bez daty"}] ${i.source_url}`
    )
    .join("\n");
}

/**
 * Narzędzie, którym model oddaje wynik przebiegu.
 *
 * Wcześniej wynik szedł jako blok JSON na końcu tekstu i w pełnym przebiegu
 * próbnym (8 października) dwa przebiegi z sześciu się wywróciły: raz JSON
 * się nie parsował, raz odpowiedź urwała się na `max_tokens`. Wejście
 * narzędzia ze `strict: true` waliduje API, więc kształt jest pewny. Tekst
 * zostaje drogą zapasową (`extractJson`), gdy model narzędzia nie wywoła.
 */
const SUBMIT_TOOL_NAME = "zapisz_wyniki";

const nullableString = { type: ["string", "null"] };

const SUBMIT_TOOL = {
  name: SUBMIT_TOOL_NAME,
  description:
    "Zapisuje wynik przebiegu: znalezione wypowiedzi, uzupełnienia o późniejsze fakty " +
    "i uwagi. Wywołaj dokładnie raz, na końcu, po zakończeniu wyszukiwania.",
  strict: true,
  input_schema: {
    type: "object" as const,
    additionalProperties: false,
    required: ["items", "updates", "notes"],
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "date",
            "quote",
            "context",
            "source_url",
            "source_title",
            "category",
            "why_it_matters",
            "later_facts",
            "later_facts_url",
          ],
          properties: {
            date: { ...nullableString, description: "RRRR-MM-DD albo RRRR-MM, null gdy brak" },
            quote: { type: "string", description: "Dosłowny cytat albo tekst od [parafraza]" },
            context: { type: "string" },
            source_url: { type: "string", description: "Adres z wyników wyszukiwania" },
            source_title: { type: "string" },
            category: {
              type: "string",
              enum: [
                "kontrowersja",
                "sprzecznosc-z-programem",
                "zmiana-zdania",
                "zweryfikowane-przez-fakty",
                "wypowiedz",
              ],
            },
            why_it_matters: { type: "string" },
            later_facts: nullableString,
            later_facts_url: nullableString,
          },
        },
      },
      updates: {
        type: "array",
        description: "Tylko w przebiegu o późniejszych faktach; w pozostałych pusta lista.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "later_facts", "later_facts_url"],
          properties: {
            id: { type: "string" },
            later_facts: { type: "string" },
            later_facts_url: { type: "string" },
          },
        },
      },
      notes: {
        type: "string",
        description: "Imiennicy, wątpliwości co do tożsamości, czego nie udało się znaleźć",
      },
    },
  },
};

/** Okno czasowe przebiegu: ostatnie 12 miesięcy do dziś. */
export function windowLabel(todayIso: string): string {
  const d = new Date(`${todayIso}T12:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return `od ${d.toISOString().slice(0, 10)} do ${todayIso}`;
}

/**
 * Jeden przebieg z wyszukiwaniem.
 *
 * Model oddaje wynik narzędziem `zapisz_wyniki`. Źródłem prawdy o adresach są bloki
 * `web_search_tool_result`, nie tekst modelu: to z nich budujemy pulę, przeciw
 * której walidujemy pozycje (`mergeItems`).
 */
export async function runSearchPass(
  pass: PassDefinition,
  subject: DossierSubject,
  items: DossierItem[],
  todayIso: string,
): Promise<PassOutput> {
  const client = await getAnthropicClient({ timeoutMs: 125_000 });
  const verify = pass.id === "fakty";

  const userText = [
    "## Osoba",
    describeSubject(subject),
    "",
    `## Okres: ${windowLabel(todayIso)}`,
    "",
    `## Zadanie w tym przebiegu: ${pass.label}`,
    pass.focus(subject),
    "",
    verify
      ? "## Zebrane dotąd pozycje (do weryfikacji, odwołuj się przez id)"
      : "## Już zebrane źródła (nie powtarzaj tych samych wypowiedzi)",
    knownItemsList(items, verify),
    "",
    "## Format",
    "Szukaj po polsku. Celuj w 8-15 pozycji, jeśli wyszukiwanie je daje; mniej, " +
      "jeśli nie ma ich więcej, nigdy kosztem zasad. Nie komentuj między wyszukiwaniami. " +
      `Na końcu wywołaj raz narzędzie ${SUBMIT_TOOL_NAME}.`,
  ].join("\n");

  const response = await client.messages.create({
    model: GENERATION_MODEL,
    // 8192 nie wystarczało: w przebiegu próbnym odpowiedź urwała się na limicie.
    max_tokens: 16000,
    system: loadPrompt("opponent-research"),
    output_config: { effort: "medium" },
    tools: [{
      type: "web_search_20250305",
      name: "web_search",
      max_uses: pass.searches,
      user_location: { type: "approximate", country: "PL", timezone: "Europe/Warsaw" },
    }, SUBMIT_TOOL],
    messages: [{ role: "user", content: userText }],
  });

  const sources: DossierSource[] = [];
  let searchCount = 0;
  let text = "";
  let submitted: Record<string, unknown> | null = null;
  for (const block of response.content) {
    if (block.type === "server_tool_use") searchCount += 1;
    if (block.type === "tool_use" && block.name === SUBMIT_TOOL_NAME) {
      submitted = block.input as Record<string, unknown>;
    }
    if (block.type === "web_search_tool_result") {
      // Błąd narzędzia przychodzi jako obiekt, sukces jako lista wyników.
      if (Array.isArray(block.content)) {
        for (const result of block.content) {
          sources.push({
            url: result.url,
            title: result.title,
            page_age: result.page_age ?? null,
          });
        }
      }
    }
    if (block.type === "text") text += block.text;
  }

  const parsed = submitted ?? extractJson(text) as Record<string, unknown> | null;
  if (!parsed) {
    throw new Error(`Przebieg ${pass.id}: odpowiedz bez JSON (stop: ${response.stop_reason})`);
  }
  return {
    rawItems: parsed.items,
    rawUpdates: parsed.updates,
    notes: typeof parsed.notes === "string" ? parsed.notes.trim().slice(0, 600) : "",
    sources,
    searchCount,
  };
}

/**
 * Schemat syntezy dla structured outputs. W przebiegu próbnym 8 października
 * synteza z JSON-em w tekście wróciła nieparsowalna i teczka nie miała ani
 * linii, ani punktów ataku; `output_config.format` daje gwarancję kształtu.
 */
const SYNTHESIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["linia", "punkty_ataku", "czego_unikac", "luki"],
  properties: {
    linia: { type: "string" },
    punkty_ataku: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["teza", "item_ids", "jak_uzyc", "obrona_przeciwnika"],
        properties: {
          teza: { type: "string" },
          item_ids: { type: "array", items: { type: "string" } },
          jak_uzyc: { type: "string" },
          obrona_przeciwnika: { type: "string" },
        },
      },
    },
    czego_unikac: { type: "array", items: { type: "string" } },
    luki: { type: "array", items: { type: "string" } },
  },
};

/** Synteza bez wyszukiwania: linia, punkty ataku, czego unikać, luki. */
export async function runSynthesis(
  subject: DossierSubject,
  items: DossierItem[],
  politician: { boundaries: unknown; values: unknown } | null,
  failedPasses: string[],
): Promise<unknown> {
  const client = await getAnthropicClient({ timeoutMs: 125_000 });
  const list = items
    .map((i) =>
      `- ${i.id} [${i.date ?? "bez daty"}] (${i.category}) ${i.quote}` +
      (i.context ? `\n  kontekst: ${i.context}` : "") +
      (i.later_facts ? `\n  później: ${i.later_facts}` : "") +
      `\n  źródło: ${i.source_title}`
    )
    .join("\n");

  const userText = [
    "## Oponent",
    describeSubject(subject),
    "",
    "## Granice i wartości polityka, dla którego przygotowujesz teczkę",
    JSON.stringify(politician ?? { boundaries: null, values: null }),
    "",
    failedPasses.length > 0
      ? `## Przebiegi, które się nie powiodły: ${failedPasses.join(", ")}`
      : "## Wszystkie przebiegi wyszukiwania się powiodły.",
    "",
    `## Pozycje teczki (${items.length})`,
    list || "(brak pozycji)",
  ].join("\n");

  const response = await client.messages.create({
    model: GENERATION_MODEL,
    max_tokens: 16000,
    system: loadPrompt("opponent-synthesis"),
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: SYNTHESIS_SCHEMA },
    },
    messages: [{ role: "user", content: userText }],
  });
  let text = "";
  for (const block of response.content) {
    if (block.type === "text") text += block.text;
  }
  return extractJson(text);
}
