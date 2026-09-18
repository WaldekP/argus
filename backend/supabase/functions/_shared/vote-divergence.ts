/**
 * Silnik rozjazdów w głosowaniach: czym poseł różni się od własnego klubu.
 *
 * Po co to istnieje. Przygotowanie do rozmowy z politykiem medialnym opiera się
 * dziś na jego wystąpieniach, a tych prawie nie ma: pomiar z 17 września 2026
 * na rzeczniku Konfederacji dał 4 wystąpienia sejmowe i 935 głosów w pół roku.
 * Materiał jest w głosowaniach, tylko nikt ich ręcznie nie przejrzy. Ten moduł
 * przegląda je za człowieka.
 *
 * Punkt odniesienia to **stanowisko większości klubu**, nie konkretny lider
 * (decyzja usera 2026-09-18). API Sejmu nie zna pojęcia lidera, lista liderów
 * wymagałaby ręcznego utrzymania, a lider bywa nieobecny: Mentzen opuścił
 * 263 z 935 głosowań, więc porównanie z nim milczałoby co czwarty raz.
 * Przy trójwartościowym głosie mediana sprowadza się do dominanty, dlatego
 * w kodzie mowa o stanowisku większości, a nie o medianie.
 *
 * Cała arytmetyka jest czysta: liczy na wierszach podanych z zewnątrz, bez
 * sieci i bez modelu, więc wynik jest powtarzalny i da się go obronić przed
 * dziennikarzem. Pobieranie głosów robi `importGlobalMpVotesForDays`
 * z `sejm.ts`, a jedyny odczyt z bazy siedzi na końcu pliku
 * (`loadClubVotingRows`), osobno od liczenia.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Głos oddany. `absent` jest nieobecnością, nie stanowiskiem. */
export type CastVote = "for" | "against" | "abstain";

/** Wartości enumu `vote_value` w bazie. */
export type VoteValue = CastVote | "absent";

export function isCast(vote: VoteValue): vote is CastVote {
  return vote === "for" || vote === "against" || vote === "abstain";
}

/**
 * Próg, od którego uznajemy, że klub MIAŁ stanowisko.
 *
 * Bez progu każdy podział 9 do 7 produkowałby „rozjazd" dla siedmiu posłów
 * naraz, co jest nieprawdą: to głosowanie, w którym klub się nie zgadza,
 * a nie odszczepieństwo. Przy 0,75 klub kilkunastoosobowy musi być zgodny
 * w trzech czwartych, żeby ktokolwiek mógł się od niego odróżnić.
 */
export const MIN_CLUB_SHARE = 0.75;

/** Minimalna liczba głosujących kolegów z klubu, żeby liczyć stanowisko. */
export const MIN_CLUB_CASTING = 3;

export interface ClubPosition {
  /** Stanowisko klubu albo null, gdy klub był podzielony. */
  position: CastVote | null;
  /** Udział stanowiska wśród głosujących członków klubu, 0-1. */
  share: number;
  /** Ilu członków klubu oddało głos. */
  casting: number;
}

/**
 * Stanowisko klubu z głosów jego członków.
 *
 * UWAGA: `votes` NIE MOŻE zawierać głosu badanego posła. Gdyby zawierał,
 * pojedynczy odszczepieniec obniżałby próg sam sobie i w małym klubie
 * chowałby własny rozjazd poniżej progu, czyli moduł gubiłby dokładnie te
 * przypadki, dla których powstał.
 */
export function clubPosition(
  votes: CastVote[],
  minShare: number = MIN_CLUB_SHARE,
  minCasting: number = MIN_CLUB_CASTING,
): ClubPosition {
  const casting = votes.length;
  if (casting < minCasting) return { position: null, share: 0, casting };

  const tally = new Map<CastVote, number>();
  for (const vote of votes) tally.set(vote, (tally.get(vote) ?? 0) + 1);

  let best: CastVote = "for";
  let bestCount = -1;
  for (const [vote, count] of tally) {
    if (count > bestCount) {
      best = vote;
      bestCount = count;
    }
  }

  const share = bestCount / casting;
  return share >= minShare
    ? { position: best, share, casting }
    : { position: null, share, casting };
}

/** Jedno głosowanie z głosem posła i głosami reszty klubu. */
export interface VotingRow {
  votingId: string;
  sitting: number;
  votingNo: number;
  date: string;
  title: string;
  description: string | null;
  mpVote: VoteValue;
  /** Głosy pozostałych członków klubu, bez badanego posła. */
  clubVotes: CastVote[];
}

export interface Divergence {
  votingId: string;
  sitting: number;
  votingNo: number;
  date: string;
  title: string;
  description: string | null;
  mpVote: CastVote;
  clubVote: CastVote;
  share: number;
  casting: number;
}

export interface DivergenceSummary {
  divergences: Divergence[];
  /** Głosowania, w których poseł oddał głos i klub miał stanowisko. */
  comparable: number;
  /** Głosowania odrzucone, bo klub był podzielony. */
  clubSplit: number;
  /** Głosowania, w których poseł był nieobecny, a klub głosował. */
  mpAbsent: number;
}

export function findDivergences(
  rows: VotingRow[],
  minShare: number = MIN_CLUB_SHARE,
): DivergenceSummary {
  const divergences: Divergence[] = [];
  let comparable = 0;
  let clubSplit = 0;
  let mpAbsent = 0;

  for (const row of rows) {
    const club = clubPosition(row.clubVotes, minShare);
    if (club.position === null) {
      clubSplit++;
      continue;
    }
    if (!isCast(row.mpVote)) {
      mpAbsent++;
      continue;
    }
    comparable++;
    if (row.mpVote === club.position) continue;
    divergences.push({
      votingId: row.votingId,
      sitting: row.sitting,
      votingNo: row.votingNo,
      date: row.date,
      title: row.title,
      description: row.description,
      mpVote: row.mpVote,
      clubVote: club.position,
      share: club.share,
      casting: club.casting,
    });
  }

  return { divergences, comparable, clubSplit, mpAbsent };
}

export interface DivergenceGroup {
  date: string;
  /** Tytuł druku albo punktu porządku obrad. */
  title: string;
  /** Ile głosowań w obrębie tej sprawy się rozjechało. */
  count: number;
  /** Do trzech przykładów, żeby karta nie puchła. */
  examples: { votingNo: number; description: string | null; mpVote: CastVote; clubVote: CastVote }[];
}

/**
 * Zwinięcie rozjazdów do spraw.
 *
 * Bez tego jedna ustawa produkuje kilkadziesiąt „ustaleń": 17 lipca 2026
 * rzecznik Konfederacji wstrzymał się przy 28 kolejnych poprawkach do jednego
 * druku, a klub głosował przeciw. To jest jedna decyzja polityczna, nie 28,
 * i tak musi wyglądać na ekranie.
 */
export function collapseByBill(divergences: Divergence[]): DivergenceGroup[] {
  const groups = new Map<string, DivergenceGroup>();
  for (const d of divergences) {
    const key = `${d.date}|${d.title}`;
    const group = groups.get(key) ?? {
      date: d.date,
      title: d.title,
      count: 0,
      examples: [],
    };
    group.count++;
    if (group.examples.length < 3) {
      group.examples.push({
        votingNo: d.votingNo,
        description: d.description,
        mpVote: d.mpVote,
        clubVote: d.clubVote,
      });
    }
    groups.set(key, group);
  }
  // Najpierw sprawy najliczniejsze, przy remisie najnowsze.
  return [...groups.values()].sort(
    (a, b) => b.count - a.count || b.date.localeCompare(a.date),
  );
}

export interface Attendance {
  total: number;
  cast: number;
  absent: number;
  /** Udział obecności, 0-1. */
  share: number;
}

/** Frekwencja posła w podanym zbiorze głosowań. */
export function attendance(votes: VoteValue[]): Attendance {
  const total = votes.length;
  const absent = votes.filter((v) => v === "absent").length;
  const cast = total - absent;
  return { total, cast, absent, share: total === 0 ? 0 : cast / total };
}

// ---------------------------------------------------------------------------
// Odczyt z bazy (jedyne miejsce w module, które dotyka Supabase)
// ---------------------------------------------------------------------------

/** Ile wierszy bierzemy w jednej stronie odczytu. */
const PAGE = 1000;

interface VoteRow {
  mp_id: number;
  vote: VoteValue;
  voting_id: string;
  sejm_votings: { sitting: number; voting_no: number; date: string; title: string; description: string | null } | null;
}

/**
 * Głosy posła i jego klubu z globalnych `sejm_mp_votes` od podanej daty,
 * złożone w wiersze per głosowanie.
 *
 * Stronicujemy przez `.range()`, bo PostgREST obcina odpowiedź do 1000 wierszy
 * bez żadnego sygnału błędu. Klub kilkunastoosobowy przez pół roku to
 * kilkanaście tysięcy głosów, więc bez stronicowania dostalibyśmy cichy,
 * losowy wycinek i policzyli stanowisko klubu z niepełnych danych. Ta sama
 * pułapka wyłożyła kiedyś import wystąpień (patrz komentarz w sejm.ts).
 */
export async function loadClubVotingRows(
  supabase: SupabaseClient,
  mpId: number,
  clubMpIds: number[],
  fromDate: string,
): Promise<VotingRow[]> {
  const ids = [...new Set([mpId, ...clubMpIds])];
  const byVoting = new Map<string, VotingRow>();
  const clubVotes = new Map<string, CastVote[]>();

  for (let offset = 0; ; offset += PAGE) {
    // UWAGA: lista kolumn musi byc JEDNYM literalem (patrz argus-media).
    const { data, error } = await supabase
      .from("sejm_mp_votes")
      .select(
        "mp_id, vote, voting_id, sejm_votings!inner ( sitting, voting_no, date, title, description )",
      )
      .in("mp_id", ids)
      .gte("sejm_votings.date", fromDate)
      .order("voting_id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`Odczyt sejm_mp_votes: ${error.message}`);

    const rows = (data ?? []) as unknown as VoteRow[];
    for (const row of rows) {
      const voting = Array.isArray(row.sejm_votings) ? row.sejm_votings[0] : row.sejm_votings;
      if (!voting) continue;

      if (row.mp_id === mpId) {
        const existing = byVoting.get(row.voting_id);
        byVoting.set(row.voting_id, {
          votingId: row.voting_id,
          sitting: voting.sitting,
          votingNo: voting.voting_no,
          date: voting.date,
          title: voting.title,
          description: voting.description,
          mpVote: row.vote,
          clubVotes: existing?.clubVotes ?? [],
        });
      } else if (isCast(row.vote)) {
        const bucket = clubVotes.get(row.voting_id) ?? [];
        bucket.push(row.vote);
        clubVotes.set(row.voting_id, bucket);
      }
    }

    if (rows.length < PAGE) break;
  }

  const result: VotingRow[] = [];
  for (const [votingId, row] of byVoting) {
    result.push({ ...row, clubVotes: clubVotes.get(votingId) ?? [] });
  }
  result.sort((a, b) => b.date.localeCompare(a.date) || b.votingNo - a.votingNo);
  return result;
}
