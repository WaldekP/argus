// Etap 4: structure — strukturyzacja tekstu komunikatu w badanie opinii.
//
// Dwustopniowo, dla oszczednosci (patrz config.gateModel / anthropicModel):
//   1. GATE (tani Haiku): na tytule + streszczeniu + poczatku tekstu ocenia,
//      czy komunikat niesie dane merytoryczne do ktoregos z 12 tematow.
//      Zwraca { przydatny, topicSlugs, uzasadnienie }.
//   2. EKSTRAKCJA (mocny Sonnet): tylko dla przydatnych. Czyta pelny tekst i
//      wyciaga pola typu Badanie z types.ts: termin, proba, zleceniodawca,
//      pytania i rozklady procentowe.
//
// Twarda zasada obu krokow: model NIE zmysla liczb — bierze wylacznie te obecne
// w tekscie, brak danych = null. Klucz CLAUDE_API_KEY z .env repo. Wywolania
// surowym fetch do Anthropic Messages API — bez SDK, w duchu zero-zaleznosci.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";
import { nowIso } from "./db.ts";

const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(toolRoot, "..", "..");

function loadApiKey(): string {
  const fromEnv = process.env.CLAUDE_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (fromEnv) return fromEnv;
  for (const envPath of [path.join(repoRoot, ".env"), path.join(toolRoot, ".env")]) {
    if (fs.existsSync(envPath)) {
      try {
        process.loadEnvFile(envPath);
      } catch {
        /* ignoruj, sprobujemy kolejnego */
      }
    }
  }
  const key = process.env.CLAUDE_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "Brak CLAUDE_API_KEY. Ustaw zmienna srodowiskowa albo dodaj do .env w korzeniu repo.",
    );
  }
  return key;
}

const TOPIC_LIST = `Tematy (slug — opis):
- kwota-wolna — kwota wolna od podatku
- kwota-wolna-12x — kwota wolna 12x płaca minimalna
- pit-liniowy — PIT liniowy, progi podatkowe
- podatek-belki — podatek od zysków kapitałowych, oszczędności
- dobrowolny-zus — dobrowolny ZUS, składki przedsiębiorców
- uproszczenia-przedsiebiorcy — uproszczenia podatkowe dla firm
- skladka-zdrowotna — składka zdrowotna przedsiębiorców
- konsolidacja-fiskalna — budżet, deficyt, dług, finanse publiczne
- transfery-800plus — 800 plus, świadczenia, emerytury, transfery socjalne
- euro — przyjęcie euro, integracja europejska
- obronnosc — wydatki na wojsko, NATO, wsparcie Ukrainy, uchodźcy
- klimat-energia — energetyka, atom, węgiel, OZE, klimat, ETS`;

const GATE_SYSTEM = `Jesteś selekcjonerem danych sondażowych. Oceniasz, czy komunikat CBOS zawiera dane opinii publicznej użyteczne dla któregoś z podanych tematów politycznych. Zwracasz WYŁĄCZNIE poprawny JSON, bez komentarza, bez bloków kodu.

Kryterium ścisłe: przydatny=true tylko gdy komunikat niesie konkretne wyniki (rozkłady poparcia, oceny postulatów, preferencje) merytorycznie pasujące do tematu. Czysto cykliczne badania nastrojów, zaufania do osób, ocen instytucji, autostereotypów itp. — przydatny=false, nawet jeśli poboczne pytanie ociera się o temat.`;

const EXTRACT_SYSTEM = `Jesteś analitykiem danych sondażowych. Czytasz komunikat z badań CBOS i wyciągasz z niego ustrukturyzowane dane badania opinii publicznej. Zwracasz WYŁĄCZNIE poprawny JSON, bez komentarza, bez bloków kodu.

Twarde zasady:
- Nie zmyślaj żadnych liczb. Bierz wyłącznie wartości dosłownie obecne w tekście. Czego nie ma, ustaw na null.
- Procenty w wynikach muszą pochodzić z tekstu komunikatu. Jeśli nie potrafisz przypisać liczby do odpowiedzi, pomiń tę odpowiedź.
- instytut zawsze "CBOS". zleceniodawca: jeśli tekst wskazuje zlecenie (np. na zlecenie redakcji), podaj; badanie statutowe CBOS = "badanie własne".`;

interface MetaForPrompt {
  numer: string;
  title: string;
  pubDate: string | null;
  author: string | null;
  summary: string | null;
}

function gatePrompt(meta: MetaForPrompt, textHead: string): string {
  return `${TOPIC_LIST}

Komunikat CBOS:
- numer: ${meta.numer}
- tytuł: ${meta.title}
- streszczenie: ${meta.summary ?? "brak"}

Początek treści:
"""
${textHead}
"""

Zwróć JSON:
{ "przydatny": boolean, "topicSlugs": ["slug", ...], "uzasadnienie": "jedno zdanie po polsku" }`;
}

function extractPrompt(meta: MetaForPrompt, text: string): string {
  return `${TOPIC_LIST}

Metadane komunikatu:
- numer: ${meta.numer}
- tytuł: ${meta.title}
- data publikacji: ${meta.pubDate ?? "brak"}
- autor: ${meta.author ?? "brak"}

Tekst komunikatu (może być przycięty):
"""
${text}
"""

Zwróć JSON o kształcie:
{
  "termin": "okres realizacji badania z tekstu albo null",
  "proba": "opis próby i metody z tekstu albo null",
  "zleceniodawca": "zleceniodawca albo 'badanie własne'",
  "badania": [
    {
      "pytanie": "treść pytania",
      "jakCzytac": "jak czytać i czego nie wnioskować, jedno zdanie",
      "wyniki": [ { "etykieta": "odpowiedź", "procent": 0, "kluczowy": false }, ... ]
    }
  ]
}`;
}

interface Row extends MetaForPrompt {
  id: number;
  sha256: string;
  text_path: string;
}

function stripFences(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

async function callClaude(
  apiKey: string,
  model: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const res = await fetch(config.anthropicApiUrl, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": config.anthropicVersion,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      // Wylaczamy rozszerzone myslenie: zadania to transkrypcja liczb z tekstu,
      // nie rozumowanie. Domyslnie wlaczone thinking zjadalo budzet tokenow i
      // ucinalo JSON (Unterminated string / pusta odpowiedz) na komunikatach z
      // wieloma pytaniami. Wylaczone = caly budzet idzie na wynik, deterministycznie.
      thinking: { type: "disabled" },
      system,
      messages: [{ role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = json.content?.filter((b) => b.type === "text").map((b) => b.text).join("") ?? "";
  if (!text) throw new Error("Pusta odpowiedz modelu");
  return text;
}

export interface StructureOptions {
  limit?: number;
  model?: string;
  gateModel?: string;
  /** Pomija gate — jeden model robi wszystko (jak w wersji jednostopniowej). */
  singleStage?: boolean;
  force?: boolean;
}

export async function runStructure(db: DatabaseSync, opts: StructureOptions): Promise<void> {
  const apiKey = loadApiKey();
  const extractModel = opts.model ?? config.anthropicModel;
  const gateModel = opts.gateModel ?? config.gateModel;

  const rows = db
    .prepare(
      `SELECT k.id, k.numer, k.title, k.summary, k.pub_date AS pubDate, k.author, k.sha256, x.text_path
       FROM komunikaty k
       JOIN extractions x ON x.sha256 = k.sha256 AND x.status = 'ok'
       LEFT JOIN structured s ON s.komunikat_id = k.id
       WHERE k.matched = 1 AND k.pdf_status = 'stored'
         AND (${opts.force ? "1=1" : "s.komunikat_id IS NULL OR s.status = 'error'"})
       ORDER BY k.year DESC, k.num DESC
       ${opts.limit ? "LIMIT " + Math.floor(opts.limit) : ""}`,
    )
    .all() as unknown as Row[];

  if (rows.length === 0) {
    console.log("Brak komunikatow do strukturyzacji. Najpierw: crawl + extract.");
    return;
  }
  console.log(
    `Do strukturyzacji: ${rows.length} komunikatow ` +
      (opts.singleStage ? `(jednostopniowo, ${extractModel})` : `(gate ${gateModel} -> ekstrakcja ${extractModel})`),
  );

  const upsert = db.prepare(`
    INSERT INTO structured (komunikat_id, status, model, badanie, structured_at, error)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(komunikat_id) DO UPDATE SET
      status = excluded.status, model = excluded.model, badanie = excluded.badanie,
      structured_at = excluded.structured_at, error = excluded.error
  `);

  const counts: Record<string, number> = {};
  let done = 0;
  let gateOnly = 0;
  for (const row of rows) {
    done++;
    let status = "error";
    let badanie: string | null = null;
    let error: string | null = null;
    let modelUsed = gateModel;

    try {
      const text = fs.readFileSync(path.join(config.textDir, row.text_path), "utf8");

      // Krok 1: gate (chyba ze singleStage — wtedy od razu pelna ekstrakcja).
      let przydatny = true;
      let topicSlugs: string[] = [];
      let uzasadnienie = "";
      if (!opts.singleStage) {
        const gateRaw = await callClaude(
          apiKey,
          gateModel,
          GATE_SYSTEM,
          gatePrompt(row, text.slice(0, config.gateMaxChars)),
          // Zapas na ewentualne bloki thinking modelu przed wlasciwym JSON-em.
          1200,
        );
        const gate = JSON.parse(stripFences(gateRaw)) as {
          przydatny?: boolean;
          topicSlugs?: string[];
          uzasadnienie?: string;
        };
        przydatny = gate.przydatny === true;
        topicSlugs = Array.isArray(gate.topicSlugs) ? gate.topicSlugs : [];
        uzasadnienie = gate.uzasadnienie ?? "";
      }

      if (!przydatny) {
        // Odrzucone przez gate — nie placimy za Sonnet.
        badanie = JSON.stringify({ przydatny: false, uzasadnienie, topicSlugs: [], badania: [] });
        status = "ok";
        gateOnly++;
      } else {
        // Krok 2: ekstrakcja (Sonnet) z pelnego tekstu.
        modelUsed = extractModel;
        const raw = await callClaude(
          apiKey,
          extractModel,
          EXTRACT_SYSTEM,
          extractPrompt(row, text.slice(0, config.structureMaxChars)),
          // Komunikaty z wieloma pytaniami daja duzy JSON (najwieksze ~7k tokenow
          // wyniku); 12000 daje zapas. Thinking wylaczone w callClaude, wiec caly
          // budzet idzie na wlasciwy JSON.
          12000,
        );
        const extracted = JSON.parse(stripFences(raw)) as Record<string, unknown>;
        badanie = JSON.stringify({
          przydatny: true,
          uzasadnienie,
          topicSlugs:
            topicSlugs.length > 0
              ? topicSlugs
              : Array.isArray(extracted.topicSlugs)
                ? extracted.topicSlugs
                : [],
          termin: extracted.termin ?? null,
          proba: extracted.proba ?? null,
          zleceniodawca: extracted.zleceniodawca ?? null,
          badania: Array.isArray(extracted.badania) ? extracted.badania : [],
        });
        status = "ok";
      }
    } catch (err) {
      error = (err instanceof Error ? err.message : String(err)).slice(0, 300);
    }

    upsert.run(row.id, status, modelUsed, badanie, nowIso(), error);
    counts[status] = (counts[status] ?? 0) + 1;
    const tag = status === "ok" ? (modelUsed === gateModel ? "odrzucony (gate)" : "przydatny") : "blad";
    console.log(`  ${done}/${rows.length} #${row.numer}: ${tag}${error ? " — " + error : ""}`);
  }

  console.log(
    "Wynik: " +
      Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(", ") +
      (opts.singleStage ? "" : ` | odrzucone przez gate (bez Sonnet): ${gateOnly}`),
  );
}
