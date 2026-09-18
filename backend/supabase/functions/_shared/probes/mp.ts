/**
 * Sondy o pośle: tożsamość, wystąpienia, rozjazdy z klubem, wejścia do programów.
 *
 * Każda sonda jest opakowaniem kodu, który już działa, w jeden kontrakt
 * (`types.ts`). Nic tu nie pobiera z sieci na nowo poza API Sejmu, które i tak
 * jest jedynym źródłem tożsamości.
 */

import {
  emptyResult,
  type Evidence,
  type Finding,
  type Probe,
  type ProbeContext,
  type ProbeResult,
  type Subject,
  type TimeWindow,
} from "./types.ts";
import { getClubMps, getMp } from "../sejm.ts";
import {
  attendance,
  collapseByBill,
  findDivergences,
  loadClubVotingRows,
} from "../vote-divergence.ts";

function mpId(subject: Subject): number | null {
  const raw = typeof subject.id === "number" ? subject.id : Number(subject.id);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

// ---------------------------------------------------------------------------
// sejm.identity
// ---------------------------------------------------------------------------

export const identityProbe: Probe = {
  id: "sejm.identity",
  label: "Kim jest",
  appliesTo: ["mp"],
  cost: "cheap",
  async run(_ctx, subject, window): Promise<ProbeResult> {
    const id = mpId(subject);
    if (id === null) {
      return emptyResult(identityProbe, window, "poseł", ["Brak numeru posła."]);
    }
    const mp = await getMp(id);
    if (!mp) {
      return emptyResult(identityProbe, window, "poseł", [
        "API Sejmu nie zna posła o tym numerze.",
      ]);
    }
    return {
      probe: identityProbe.id,
      label: identityProbe.label,
      summary: {
        mp_id: mp.id,
        full_name: mp.firstLastName,
        club: mp.club ?? null,
        district: mp.districtName ?? null,
        profession: mp.profession ?? null,
        active: mp.active,
      },
      findings: [],
      coverage: { checked: 1, unit: "poseł", from: window.from, to: window.to, gaps: [] },
    };
  },
};

// ---------------------------------------------------------------------------
// sejm.statements
// ---------------------------------------------------------------------------

/** Ile wystąpień pokazujemy. Karta ma być czytelna, nie kompletna. */
const STATEMENTS_LIMIT = 10;

/** Pierwsze zdania wystąpienia, żeby karta niosła treść, a nie sam licznik. */
function lead(text: string, max = 400): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max).trimEnd()}...`;
}

/** Nagłówek punktu porządku obrad, który stenogram wkleja przed wypowiedzią. */
const AGENDA_LINE =
  /^(?:\d+\.\s|Sprawozdanie |Pierwsze czytanie|Drugie czytanie|Przedstawiony przez|Informacja |Pytania w sprawach|Wniosek )/;

/**
 * Rozdzielenie stenogramu na punkt obrad i samą wypowiedź.
 *
 * Bez tego tytułem ustalenia zostawał nagłówek w rodzaju „Sprawozdanie Komisji
 * o rządowym projekcie ustawy...", jednakowy dla wszystkich mówców tego dnia,
 * zamiast tego, co poseł faktycznie powiedział.
 */
export function splitAgenda(text: string): { agenda: string | null; speech: string } {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) return { agenda: null, speech: text.trim() };

  const agenda: string[] = [];
  let index = 0;
  while (index < lines.length && AGENDA_LINE.test(lines[index])) {
    agenda.push(lines[index]);
    index++;
  }
  if (agenda.length === 0 || index >= lines.length) {
    return { agenda: null, speech: text.trim() };
  }
  return { agenda: agenda.join(" "), speech: lines.slice(index).join("\n") };
}

export const statementsProbe: Probe = {
  id: "sejm.statements",
  label: "Co mówił z mównicy",
  appliesTo: ["mp"],
  cost: "free",
  async run(ctx, subject, window): Promise<ProbeResult> {
    const id = mpId(subject);
    if (id === null) {
      return emptyResult(statementsProbe, window, "wystąpienie", ["Brak numeru posła."]);
    }

    const { data, error } = await ctx.supabase
      .from("sejm_statements")
      .select("id, date, text")
      .eq("mp_id", id)
      .gte("date", window.from)
      .order("date", { ascending: false })
      .limit(STATEMENTS_LIMIT);
    if (error) {
      return {
        ...emptyResult(statementsProbe, window, "wystąpienie", [
          "Nie udało się odczytać wystąpień.",
        ]),
        error: error.message,
      };
    }

    // Ile wystąpień tego posła ma baza W OGÓLE, bez okna.
    //
    // Bez tego licznika sonda nie odróżnia „nie zabierał głosu" od „nie
    // zaimportowaliśmy jego wystąpień", a to są zdania o czymś zupełnie innym.
    // Pierwsza wersja twierdziła, że rzecznik Konfederacji milczał przez pół
    // roku, podczas gdy miał cztery wystąpienia, tylko nie było ich w bazie.
    const { count: everCount } = await ctx.supabase
      .from("sejm_statements")
      .select("id", { count: "exact", head: true })
      .eq("mp_id", id);

    const rows = data ?? [];
    const findings: Finding[] = rows.map((row) => {
      const { agenda, speech } = splitAgenda(row.text as string);
      return {
        probe: statementsProbe.id,
        kind: "wystapienie",
        severity: 1 as const,
        title: lead(speech, 90),
        description: agenda ?? lead(speech),
        evidence: [{
          type: "statement",
          quote: lead(speech, 700),
          date: (row.date as string | null) ?? null,
          ref: row.id as string,
        }],
      };
    });

    // Cztery wystąpienia w pół roku to nie jest awaria sondy, tylko fakt
    // o pośle, i karta musi to rozróżniać od braku danych.
    const gaps = ["Wystąpienia poza Sejmem (studia, podcasty, X) nie są w bazie."];
    const imported = (everCount ?? 0) > 0;
    if (rows.length === 0) {
      gaps.unshift(
        imported
          ? "W tym oknie poseł nie zabierał głosu na sali."
          : "Wystąpienia tego posła nie zostały jeszcze zaimportowane, więc nie wiemy, czy zabierał głos.",
      );
    }

    return {
      probe: statementsProbe.id,
      label: statementsProbe.label,
      summary: { count: rows.length, imported },
      findings,
      coverage: {
        checked: rows.length,
        unit: "wystąpienie",
        from: window.from,
        to: window.to,
        gaps,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// club.divergence
// ---------------------------------------------------------------------------

const VOTE_LABEL: Record<string, string> = {
  for: "za",
  against: "przeciw",
  abstain: "wstrzymał się",
};

export const divergenceProbe: Probe = {
  id: "club.divergence",
  label: "Rozjazdy z klubem",
  appliesTo: ["mp"],
  cost: "free",
  async run(ctx, subject, window): Promise<ProbeResult> {
    const id = mpId(subject);
    if (id === null || !subject.club) {
      return emptyResult(divergenceProbe, window, "głosowanie", [
        "Poseł bez klubu, nie ma z czym porównywać.",
      ]);
    }

    const members = (await getClubMps(subject.club)).map((m) => m.id);
    const rows = await loadClubVotingRows(ctx.supabase, id, members, window.from);

    // Ten sam bezpiecznik co w operacji divergence_get: brak zebranych głosów
    // klubu dałby "zero rozjazdów", co wygląda jak wynik, a jest brakiem danych.
    const covered = rows.filter((r) => r.clubVotes.length > 0).length;
    if (rows.length === 0 || covered < rows.length / 2) {
      return emptyResult(divergenceProbe, window, "głosowanie", [
        "Głosy klubu nie są jeszcze zebrane, więc porównania nie ma.",
      ]);
    }

    const summary = findDivergences(rows);
    const stats = attendance(rows.map((r) => r.mpVote));
    const groups = collapseByBill(summary.divergences);

    const findings: Finding[] = groups.map((group) => {
      const example = group.examples[0];
      const evidence: Evidence[] = group.examples.map((e) => ({
        type: "vote",
        quote: `${e.description ?? "głosowanie"}: on ${VOTE_LABEL[e.mpVote]}, klub ${VOTE_LABEL[e.clubVote]}`,
        date: group.date,
      }));
      return {
        probe: divergenceProbe.id,
        kind: "rozjazd-z-klubem",
        // Rozjazd przy całości projektu waży więcej niż przy poprawce,
        // a seria powtórzonych głosów to jedna decyzja, nie kilkadziesiąt.
        severity: group.count >= 5 ? 3 : group.count >= 2 ? 2 : 1,
        title: group.title,
        description:
          `Zagłosował ${VOTE_LABEL[example.mpVote]}, klub ${VOTE_LABEL[example.clubVote]}` +
          (group.count > 1 ? `, w ${group.count} głosowaniach nad tą sprawą.` : "."),
        evidence,
      };
    });

    return {
      probe: divergenceProbe.id,
      label: divergenceProbe.label,
      summary: {
        club: subject.club,
        club_size: members.length,
        votings: rows.length,
        comparable: summary.comparable,
        club_split: summary.clubSplit,
        divergences: summary.divergences.length,
        cases: groups.length,
        attendance_share: Math.round(stats.share * 1000) / 1000,
        absent: stats.absent,
      },
      findings,
      coverage: {
        checked: summary.comparable,
        unit: "głosowanie",
        from: window.from,
        to: window.to,
        gaps: summary.clubSplit > 0
          ? [`${summary.clubSplit} głosowań pominięto, bo klub był podzielony.`]
          : [],
      },
    };
  },
};

// ---------------------------------------------------------------------------
// program.appearances
// ---------------------------------------------------------------------------

export const appearancesProbe: Probe = {
  id: "program.appearances",
  label: "Wejścia do programów",
  appliesTo: ["mp", "person"],
  cost: "free",
  async run(ctx, subject, window): Promise<ProbeResult> {
    const { data, error } = await ctx.supabase
      .from("program_episodes")
      .select("id, url, title, guests, published_at, summary, programs ( name, slug )")
      .gte("published_at", `${window.from}T00:00:00Z`)
      .order("published_at", { ascending: false })
      .limit(500);
    if (error) {
      return {
        ...emptyResult(appearancesProbe, window, "odcinek", [
          "Nie udało się odczytać archiwum programów.",
        ]),
        error: error.message,
      };
    }

    // Dopasowanie po nazwisku, bo `guests` trzyma tekst, a nie mp_id. To jest
    // znany szew: nazwisko bez imienia złapie imienników (dwoje Bosaków
    // w jednym klubie), więc porównujemy pełne nazwy z obu stron.
    const needle = subject.name.toLowerCase();
    const rows = (data ?? []).filter((row) => {
      const guests = Array.isArray(row.guests) ? (row.guests as string[]) : [];
      return guests.some((g) => g.toLowerCase() === needle || g.toLowerCase().includes(needle));
    });

    const findings: Finding[] = rows.map((row) => {
      const program = Array.isArray(row.programs) ? row.programs[0] : row.programs;
      return {
        probe: appearancesProbe.id,
        kind: "wejscie-do-programu",
        severity: 1 as const,
        title: (row.title as string) ?? "Odcinek",
        description: program?.name ? `${program.name}` : "Program publicystyczny",
        evidence: [{
          type: "episode",
          quote: (row.summary as string | null) ?? undefined,
          date: (row.published_at as string | null)?.slice(0, 10) ?? null,
          url: row.url as string,
          ref: row.id as string,
        }],
      };
    });

    return {
      probe: appearancesProbe.id,
      label: appearancesProbe.label,
      summary: { count: rows.length, scanned: (data ?? []).length },
      findings,
      coverage: {
        checked: (data ?? []).length,
        unit: "odcinek",
        from: window.from,
        to: window.to,
        gaps: [
          "Archiwum obejmuje ostatnią serię odcinków pięciu programów TVN24, nie całą telewizję.",
        ],
      },
    };
  },
};

export const MP_PROBES: Probe[] = [
  identityProbe,
  statementsProbe,
  divergenceProbe,
  appearancesProbe,
];
