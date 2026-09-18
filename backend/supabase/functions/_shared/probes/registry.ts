/**
 * Rejestr sond i uruchamianie zestawów.
 *
 * Zestaw pytań jest osobnym bytem od kodu sondy: „przygotowanie do rozmowy"
 * to deklaracja, które sondy i w jakiej kolejności, a nie funkcja. Dzięki temu
 * dodanie źródła (transkrypty wejść, X) to nowa sonda, a wszystkie konteksty
 * dostają ją bez zmian u siebie.
 */

import {
  type Probe,
  type ProbeContext,
  type ProbeCost,
  type ProbeResult,
  type Subject,
  type TimeWindow,
} from "./types.ts";
import { MP_PROBES } from "./mp.ts";

export const PROBES: Probe[] = [...MP_PROBES];

export function probeById(id: string): Probe | null {
  return PROBES.find((p) => p.id === id) ?? null;
}

/** Nazwane zestawy pytań. Konsument wybiera zestaw, nie pojedyncze sondy. */
export const PROBE_SETS: Record<string, string[]> = {
  /** Karta posła i przygotowanie do rozmowy. */
  "karta-posla": [
    "sejm.identity",
    "club.divergence",
    "sejm.statements",
    "program.appearances",
  ],
};

/** Koszty, których zestaw nie ma prawa ponieść bez zgody konsumenta. */
const BLOCKED_BY_DEFAULT: ProbeCost[] = ["paid"];

export interface RunOptions {
  /** Dopuszczenie sond płatnych (Rejestr.io). Domyślnie nie. */
  allowPaid?: boolean;
}

export interface DossierResult {
  subject: Subject;
  window: TimeWindow;
  results: ProbeResult[];
  /** Sondy pominięte i dlaczego, żeby brak sekcji nie wyglądał jak brak danych. */
  skipped: { probe: string; reason: string }[];
}

/**
 * Uruchomienie zestawu sond na jednym podmiocie.
 *
 * Sondy chodzą po kolei i każda jest FAIL-SOFT: awaria jednej nie wywraca
 * dossier, tylko ląduje w jej własnym polu `error` i w lukach. Ta sama zasada
 * co w `knowledge-search.ts`: wzbogacenie nie może być zależnością.
 */
export async function runProbeSet(
  ctx: ProbeContext,
  setName: string,
  subject: Subject,
  window: TimeWindow,
  options: RunOptions = {},
): Promise<DossierResult> {
  const ids = PROBE_SETS[setName];
  if (!ids) throw new Error(`Nieznany zestaw sond: ${setName}`);

  const results: ProbeResult[] = [];
  const skipped: { probe: string; reason: string }[] = [];

  for (const id of ids) {
    const probe = probeById(id);
    if (!probe) {
      skipped.push({ probe: id, reason: "Sonda nie jest zarejestrowana." });
      continue;
    }
    if (!probe.appliesTo.includes(subject.kind)) {
      skipped.push({ probe: id, reason: `Sonda nie dotyczy podmiotu typu ${subject.kind}.` });
      continue;
    }
    if (BLOCKED_BY_DEFAULT.includes(probe.cost) && !options.allowPaid) {
      skipped.push({ probe: id, reason: "Sonda płatna, pominięta bez wyraźnej zgody." });
      continue;
    }

    try {
      results.push(await probe.run(ctx, subject, window));
    } catch (error) {
      results.push({
        probe: probe.id,
        label: probe.label,
        summary: {},
        findings: [],
        coverage: {
          checked: 0,
          unit: "",
          from: window.from,
          to: window.to,
          gaps: ["Sonda nie odpowiedziała, danych z tego źródła brak."],
        },
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { subject, window, results, skipped };
}
