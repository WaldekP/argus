// Klient oficjalnego API Sejmu RP (https://api.sejm.gov.pl), kadencja 10.
// Endpointy zweryfikowane na zywym API (2026-07):
//   GET /sejm/term10/MP                                  — lista poslow
//   GET /sejm/term10/MP/{id}                             — dane posla
//   GET /sejm/term10/proceedings                         — posiedzenia (number, dates)
//   GET /sejm/term10/MP/{id}/votings/{sitting}/{date}    — glosy posla danego dnia
//   GET /sejm/term10/proceedings/{num}/{date}/transcripts        — lista wystapien
//   GET /sejm/term10/proceedings/{num}/{date}/transcripts/{num}  — tresc (HTML)
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const SEJM_API = "https://api.sejm.gov.pl/sejm/term10";
const FETCH_TIMEOUT_MS = 25000;

// Limity porcjowania: import jest sterowany z klienta (petla wywolan),
// kazde wywolanie robi jeden maly krok — limit zasobow workera Edge Functions.
const MIN_STATEMENT_CHARS = 150;
const MAX_STATEMENT_CHARS = 12000;
const DB_CHUNK = 100;
const HTML_CONCURRENCY = 4;

export interface SejmMp {
  id: number;
  firstLastName: string;
  lastFirstName: string;
  club?: string;
  districtName?: string;
  districtNum?: number;
  voivodeship?: string;
  active: boolean;
  profession?: string;
}

export interface MpSearchResult {
  mp_id: number;
  full_name: string;
  club: string;
  district_name: string;
  active: boolean;
}

export interface ProceedingDay {
  sitting: number;
  date: string; // YYYY-MM-DD
}

interface MpDayVoting {
  votingNumber: number;
  date: string;
  title?: string;
  description?: string;
  topic?: string;
  vote: string;
  kind?: string;
}

interface TranscriptMeta {
  num: number;
  memberID: number;
  name?: string;
  unspoken?: boolean;
}

// --- fetch z timeoutem i jednym retry -------------------------------------

async function fetchJson<T>(path: string): Promise<T | null> {
  const url = `${SEJM_API}${path}`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { Accept: "application/json" },
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`API Sejmu: HTTP ${res.status} dla ${path}`);
      return (await res.json()) as T;
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
  return null;
}

// Zwraca null takze przy powtorzonym bledzie/timeoutcie (pojedyncze
// wystapienie wolno pominac; krok importu nie moze wywracac sie przez
// jeden powolny dokument API Sejmu).
async function fetchHtml(path: string): Promise<string | null> {
  const url = `${SEJM_API}${path}`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`API Sejmu: HTTP ${res.status} dla ${path}`);
      return await res.text();
    } catch (err) {
      if (attempt === 2) {
        console.warn(`Pominieto wystapienie (${path}):`, err);
        return null;
      }
    }
  }
  return null;
}

// --- poslowie ---------------------------------------------------------------

let mpListCache: SejmMp[] | null = null;

async function getMpList(): Promise<SejmMp[]> {
  if (!mpListCache) {
    const list = await fetchJson<SejmMp[]>("/MP");
    mpListCache = list ?? [];
  }
  return mpListCache;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l");
}

// Wyszukiwanie posla po fragmencie nazwiska/imienia (min 2 znaki), max 10.
export async function searchMps(query: string): Promise<MpSearchResult[]> {
  const q = normalize(query.trim());
  if (q.length < 2) return [];
  const list = await getMpList();
  return list
    .filter((mp) =>
      normalize(mp.firstLastName ?? "").includes(q) ||
      normalize(mp.lastFirstName ?? "").includes(q)
    )
    .sort((a, b) => Number(b.active) - Number(a.active))
    .slice(0, 10)
    .map((mp) => ({
      mp_id: mp.id,
      full_name: mp.firstLastName,
      club: mp.club ?? "",
      district_name: mp.districtName ?? "",
      active: mp.active,
    }));
}

export async function getMp(id: number): Promise<SejmMp | null> {
  return await fetchJson<SejmMp>(`/MP/${id}`);
}

// --- posiedzenia ------------------------------------------------------------

// Dni posiedzen (number > 0, daty przeszle), posortowane od najnowszych.
export async function getPastProceedingDays(): Promise<ProceedingDay[]> {
  const proceedings = await fetchJson<
    { number: number; dates: string[]; current?: boolean }[]
  >("/proceedings");
  if (!proceedings) return [];

  const today = new Date().toISOString().slice(0, 10);
  const days: ProceedingDay[] = [];
  const seen = new Set<string>();
  for (const p of proceedings) {
    if (!p.number || p.number <= 0) continue; // number 0 = tylko plan
    for (const date of p.dates ?? []) {
      if (date > today) continue;
      const key = `${p.number}:${date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      days.push({ sitting: p.number, date });
    }
  }
  days.sort((a, b) => b.date.localeCompare(a.date));
  return days;
}

export function latestSittingNumber(days: ProceedingDay[]): number {
  return days.reduce((max, d) => Math.max(max, d.sitting), 0);
}

// --- import glosowan posla ----------------------------------------------------

const VOTE_MAP: Record<string, string> = {
  YES: "for",
  NO: "against",
  ABSTAIN: "abstain",
  ABSENT: "absent",
};

export interface VotingsImportResult {
  votings: number;
  votes: number;
}

// Glosowania posla dla wskazanych dni -> upsert sejm_votings (globalnie,
// po (sitting, voting_no)) + politician_votes tenanta. Jeden krok petli importu.
export async function importMpVotingsForDays(
  supabase: SupabaseClient,
  tenantId: string,
  mpId: number,
  days: ProceedingDay[],
  maxVotings: number,
): Promise<VotingsImportResult> {
  const collected: {
    sitting: number;
    voting_no: number;
    date: string;
    title: string;
    description: string | null;
    vote: string;
  }[] = [];

  for (const day of days) {
    if (collected.length >= maxVotings) break;
    const list = await fetchJson<MpDayVoting[]>(
      `/MP/${mpId}/votings/${day.sitting}/${day.date}`,
    );
    if (!list) continue;
    for (const item of list) {
      const vote = VOTE_MAP[item.vote];
      if (!vote) continue; // glosowania imienne/listowe (VOTE_VALID itp.) pomijamy
      collected.push({
        sitting: day.sitting,
        voting_no: item.votingNumber,
        date: (item.date ?? day.date).slice(0, 10),
        title: item.title ?? item.topic ?? "Glosowanie",
        description: item.description ?? null,
        vote,
      });
      if (collected.length >= maxVotings) break;
    }
  }

  if (collected.length === 0) return { votings: 0, votes: 0 };

  // Upsert glosowan globalnych i mapowanie (sitting, voting_no) -> id.
  const votingIdByKey = new Map<string, string>();
  for (let i = 0; i < collected.length; i += DB_CHUNK) {
    const chunk = collected.slice(i, i + DB_CHUNK);
    const { data, error } = await supabase
      .from("sejm_votings")
      .upsert(
        chunk.map((c) => ({
          sitting: c.sitting,
          voting_no: c.voting_no,
          date: c.date,
          title: c.title.slice(0, 2000),
          description: c.description,
        })),
        { onConflict: "sitting,voting_no" },
      )
      .select("id, sitting, voting_no");
    if (error) throw new Error(`Zapis sejm_votings: ${error.message}`);
    for (const row of data ?? []) {
      votingIdByKey.set(`${row.sitting}:${row.voting_no}`, row.id);
    }
  }

  // Upsert glosow posla w tenancie.
  const voteRows = collected
    .map((c) => {
      const votingId = votingIdByKey.get(`${c.sitting}:${c.voting_no}`);
      if (!votingId) return null;
      return { tenant_id: tenantId, voting_id: votingId, vote: c.vote };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  let votes = 0;
  for (let i = 0; i < voteRows.length; i += DB_CHUNK) {
    const chunk = voteRows.slice(i, i + DB_CHUNK);
    const { error } = await supabase
      .from("politician_votes")
      .upsert(chunk, { onConflict: "tenant_id,voting_id" });
    if (error) throw new Error(`Zapis politician_votes: ${error.message}`);
    votes += chunk.length;
  }

  return { votings: votingIdByKey.size, votes };
}

// --- import wystapien posla ---------------------------------------------------

const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
};

// Czyszczenie stenogramu z HTML: naglowki (tytul, mowca) out, tagi out,
// encje zdekodowane, biale znaki znormalizowane.
export function stripTranscriptHtml(html: string): string {
  let text = html
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<h1[\s\S]*?<\/h1>/gi, "")
    .replace(/<h2[\s\S]*?<\/h2>/gi, "")
    .replace(/<(p|div|br|blockquote)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    text = text.replaceAll(entity, char);
  }
  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .trim();
}

// Wystapienia posla dla wskazanych dni -> insert do statements tenanta
// (source='sejm') BEZ embeddingow (embedding uzupelnia osobna faza petli).
// Dni przetwarzane atomowo (caly dzien albo wcale), zeby kursor dnia w stanie
// importu byl spojny. Deduplikacja po url (retry kroku nie robi duplikatow).
export interface StatementsStepResult {
  inserted: number;
  daysProcessed: number;
}

export async function importMpStatementsForDays(
  supabase: SupabaseClient,
  tenantId: string,
  mpId: number,
  days: ProceedingDay[],
  softCap: number,
): Promise<StatementsStepResult> {
  const metas: { sitting: number; date: string; num: number }[] = [];
  let daysProcessed = 0;
  for (const day of days) {
    // Limit sprawdzany PRZED dniem: dzien zawsze przetwarzany w calosci.
    if (metas.length >= softCap) break;
    const transcript = await fetchJson<{ statements: TranscriptMeta[] }>(
      `/proceedings/${day.sitting}/${day.date}/transcripts`,
    );
    daysProcessed++;
    if (!transcript?.statements) continue;
    for (const s of transcript.statements) {
      if (s.memberID !== mpId || s.unspoken || !s.num) continue;
      metas.push({ sitting: day.sitting, date: day.date, num: s.num });
    }
  }
  if (metas.length === 0) return { inserted: 0, daysProcessed };

  // Deduplikacja: url-e juz zapisane dla tenanta pomijamy.
  const { data: existing, error: existingError } = await supabase
    .from("statements")
    .select("url")
    .eq("tenant_id", tenantId)
    .eq("source", "sejm");
  if (existingError) {
    throw new Error(`Odczyt statements: ${existingError.message}`);
  }
  const existingUrls = new Set((existing ?? []).map((r) => r.url as string));

  const texts: { date: string; url: string; text: string }[] = [];
  let cursor = 0;
  async function htmlWorker() {
    while (cursor < metas.length) {
      const meta = metas[cursor++];
      const path =
        `/proceedings/${meta.sitting}/${meta.date}/transcripts/${meta.num}`;
      const url = `${SEJM_API}${path}`;
      if (existingUrls.has(url)) continue;
      const html = await fetchHtml(path);
      if (!html) continue;
      const text = stripTranscriptHtml(html);
      if (text.length < MIN_STATEMENT_CHARS) continue; // szum proceduralny
      texts.push({
        date: meta.date,
        url,
        text: text.slice(0, MAX_STATEMENT_CHARS),
      });
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(HTML_CONCURRENCY, metas.length) },
      () => htmlWorker(),
    ),
  );

  if (texts.length === 0) return { inserted: 0, daysProcessed };

  for (let i = 0; i < texts.length; i += 50) {
    const chunk = texts.slice(i, i + 50).map((t) => ({
      tenant_id: tenantId,
      source: "sejm",
      date: t.date,
      text: t.text,
      url: t.url,
      embedding: null,
    }));
    const { error } = await supabase.from("statements").insert(chunk);
    if (error) throw new Error(`Zapis statements: ${error.message}`);
  }

  return { inserted: texts.length, daysProcessed };
}

// --- globalny sync glosowan (argus-ingest, cron) -------------------------------

export interface SejmSyncResult {
  from_sitting: number;
  to_sitting: number;
  upserted: number;
}

interface SittingVoting {
  sitting: number;
  votingNumber: number;
  date: string;
  title?: string;
  topic?: string;
  description?: string;
}

// Dociaga nowe glosowania globalne od ostatniego znanego posiedzenia.
export async function syncSejmVotings(
  supabase: SupabaseClient,
): Promise<SejmSyncResult> {
  const days = await getPastProceedingDays();
  const latest = latestSittingNumber(days);
  if (latest === 0) return { from_sitting: 0, to_sitting: 0, upserted: 0 };

  const { data: lastRow, error: lastError } = await supabase
    .from("sejm_votings")
    .select("sitting")
    .order("sitting", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) throw new Error(`Odczyt sejm_votings: ${lastError.message}`);

  // Od ostatniego znanego posiedzenia (wlacznie — moglo dojsc cos w trakcie);
  // przy pustej bazie tylko 3 ostatnie posiedzenia (cron dogoni reszte).
  const fromSitting = lastRow?.sitting
    ? lastRow.sitting
    : Math.max(1, latest - 2);

  let upserted = 0;
  for (let sitting = fromSitting; sitting <= latest; sitting++) {
    const votings = await fetchJson<SittingVoting[]>(`/votings/${sitting}`);
    if (!votings || votings.length === 0) continue;
    const rows = votings.map((v) => ({
      sitting,
      voting_no: v.votingNumber,
      date: (v.date ?? "").slice(0, 10),
      title: (v.title ?? v.topic ?? "Glosowanie").slice(0, 2000),
      description: v.description ?? null,
    })).filter((r) => r.date);
    for (let i = 0; i < rows.length; i += DB_CHUNK) {
      const chunk = rows.slice(i, i + DB_CHUNK);
      const { error } = await supabase
        .from("sejm_votings")
        .upsert(chunk, { onConflict: "sitting,voting_no" });
      if (error) throw new Error(`Zapis sejm_votings: ${error.message}`);
      upserted += chunk.length;
    }
  }

  return { from_sitting: fromSitting, to_sitting: latest, upserted };
}
