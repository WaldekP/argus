/**
 * Wspólny kontrakt sond, czyli tego, co Argus sprawdza o podmiocie.
 *
 * Skąd to się wzięło. Przygotowanie do rozmowy zadaje za każdym razem ten sam
 * zestaw pytań (kim jest, co mówił, jak głosował, gdzie się rozjeżdża, gdzie
 * ostatnio występował, czego nie wiemy), tylko o kogo innego. Powtarza się
 * zestaw pytań, zmienia się podmiot i okno. Dotąd każde z tych pytań żyło
 * w innym pliku i zwracało inny kształt: `sejm.ts` wiersze do zapisu,
 * `knowledge-search.ts` gotowy tekst do promptu, `argus-analysis` ustalenia
 * z dowodami, `argus-media` listy. Każdy nowy konsument musiał się nauczyć
 * wszystkich naraz.
 *
 * Słownik ustaleń celowo NIE jest nowy: `severity`, `title`, `description`
 * i `evidence` z datą i referencją to ten sam kształt, który chodzi już
 * w analizach niespójności i jest renderowany na ekranie.
 *
 * Granica, przy której warto się upierać: sondy są GLOBALNE i DETERMINISTYCZNE,
 * synteza jest TENANTOWA i MODELOWA. Jak ktoś głosował, to fakt wspólny dla
 * wszystkich klientów. Co z tego wynika dla konkretnego polityka, zależy od
 * jego celów i granic. Ta linia pokrywa się z podziałem, który już jest w RLS.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Rodzaj podmiotu, o który pytamy. */
export type SubjectKind = "mp" | "person" | "club" | "journalist" | "program" | "topic";

/**
 * Podmiot sondy.
 *
 * `id` jest identyfikatorem u źródła (mp_id dla posła, slug dla programu),
 * `name` zawsze wypełnione, bo część źródeł zna wyłącznie nazwisko.
 */
export interface Subject {
  kind: SubjectKind;
  id?: string | number;
  name: string;
  /** Klub posła. Potrzebny sondom porównującym z własnym klubem. */
  club?: string | null;
}

/** Okno czasu, w którym pytamy. */
export interface TimeWindow {
  from: string;
  to: string;
  months: number;
}

export function makeWindow(months: number): TimeWindow {
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - months);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    months,
  };
}

/** Dowód pod ustaleniem. Bez daty i referencji ustalenie jest bezwartościowe. */
export interface Evidence {
  type: "statement" | "vote" | "episode" | "article" | "document";
  /** Cytat dosłowny albo opis głosowania. */
  quote?: string;
  date: string | null;
  url?: string | null;
  /** Identyfikator wiersza w bazie, gdy istnieje. */
  ref?: string | null;
}

/** Ustalenie: rzecz warta pokazania człowiekowi, z dowodami. */
export interface Finding {
  /** Id sondy, która to znalazła. */
  probe: string;
  /** Podtyp w obrębie sondy, np. "rozjazd-z-klubem". */
  kind: string;
  /** 3 poważna, 2 istotna, 1 drobna. Ta sama skala co w analizach. */
  severity: 1 | 2 | 3;
  title: string;
  description: string;
  evidence: Evidence[];
}

/**
 * Pokrycie: co sonda faktycznie sprawdziła i czego nie wie.
 *
 * To NIE jest ozdobnik. Bez mianownika liczba ustaleń kłamie: jeden rozjazd
 * na 853 głosowania znaczy coś przeciwnego niż jeden rozjazd na trzy. A brak
 * danych bez adnotacji wygląda dokładnie jak brak problemu, co jest jedynym
 * sposobem, w jaki to narzędzie może komuś realnie zaszkodzić.
 */
export interface Coverage {
  /** Ile jednostek przejrzano (głosowań, wystąpień, odcinków). */
  checked: number;
  /** Nazwa jednostki, do wyświetlenia. */
  unit: string;
  from: string;
  to: string;
  /** Czego sonda nie wie, zdaniami gotowymi do pokazania. */
  gaps: string[];
}

/** Wynik jednej sondy. */
export interface ProbeResult {
  probe: string;
  label: string;
  /** Liczby nagłówkowe, gdy sonda nie produkuje ustaleń (np. tożsamość). */
  summary: Record<string, unknown>;
  findings: Finding[];
  coverage: Coverage;
  /** Wypełnione, gdy sonda padła. Sonda nigdy nie wywraca całego dossier. */
  error?: string;
}

/**
 * Koszt wywołania. Rejestr.io ma saldo wspólne dla wszystkich tenantów,
 * a crawle są wolne, więc konsument musi móc poprosić o sam zestaw darmowy.
 */
export type ProbeCost = "free" | "cheap" | "slow" | "paid";

export interface ProbeContext {
  supabase: SupabaseClient;
}

export interface Probe {
  id: string;
  label: string;
  appliesTo: SubjectKind[];
  cost: ProbeCost;
  run(ctx: ProbeContext, subject: Subject, window: TimeWindow): Promise<ProbeResult>;
}

/** Pusty wynik z adnotacją, do zwracania przy braku danych. */
export function emptyResult(
  probe: Probe,
  window: TimeWindow,
  unit: string,
  gaps: string[],
): ProbeResult {
  return {
    probe: probe.id,
    label: probe.label,
    summary: {},
    findings: [],
    coverage: { checked: 0, unit, from: window.from, to: window.to, gaps },
  };
}
