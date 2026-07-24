// Wyciąganie przychodu i wyniku netto z rachunku zysków i strat
// pobranego z Rejestr.io w formacie JSON (plan Biznes).
//
// Dokument jest drzewem powstałym z XML-a według schem Ministerstwa Finansów,
// a schem jest kilka i różnią się literami węzłów:
//   RZiSJednostkaInna    A  = "Przychody netto ze sprzedaży i zrównane z nimi"
//   RZiSJednostkaOp      A  = "Przychody z działalności statutowej"
//                        D  = "Przychody z działalności gospodarczej"
//   RZiSJednostkaMala / Mikro — jeszcze inne układy.
//
// Dlatego NIE dopasowujemy po literze węzła, tylko po etykiecie księgowej,
// i bierzemy węzły najpłycej położone w drzewie, żeby złapać sumę, a nie
// jej składową (A zamiast A_I i A_IV).
//
// Kontrakt: docs/kontrakt-rejestr-krs.md

export interface StatementNode {
  nazwa_wezla?: string;
  etykieta?: string | null;
  podetykieta?: string | null;
  pln_rok_obrotowy_biezacy?: string | null;
  pln_rok_obrotowy_poprzedni?: string | null;
  podobiekty?: StatementNode[] | null;
}

export interface FinancialDocument {
  id_organizacji: number;
  id_dokumentu: number;
  nazwa: string;
  okres_data_start: string;
  okres_data_koniec: string;
  zawartosc: StatementNode;
}

/** Wynik ekstrakcji. Etykieta jest częścią wyniku, bo w różnych schemach
 * "przychód" znaczy co innego i użytkownik ma prawo wiedzieć, co widzi. */
export interface ExtractedFinancials {
  revenue: number | null;
  revenue_label: string | null;
  revenue_prev: number | null;
  net_result: number | null;
  net_result_label: string | null;
  net_result_prev: number | null;
}

interface FlatNode {
  depth: number;
  label: string;
  current: number | null;
  previous: number | null;
}

function toNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function flatten(node: StatementNode, depth = 0, out: FlatNode[] = []): FlatNode[] {
  out.push({
    depth,
    label: (node.etykieta ?? node.nazwa_wezla ?? "").trim(),
    current: toNumber(node.pln_rok_obrotowy_biezacy),
    previous: toNumber(node.pln_rok_obrotowy_poprzedni),
  });
  for (const child of node.podobiekty ?? []) flatten(child, depth + 1, out);
  return out;
}

function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l");
}

/**
 * Wybiera węzły pasujące do predykatu i leżące najpłycej w drzewie.
 * Gdy na tym poziomie jest ich kilka (organizacje pozarządowe mają przychody
 * statutowe i gospodarcze osobno), sumuje je i skleja etykiety.
 */
function pickShallowest(
  nodes: FlatNode[],
  matches: (label: string) => boolean,
): { value: number | null; previous: number | null; label: string | null } {
  const candidates = nodes.filter((n) => matches(normalizeLabel(n.label)));
  if (candidates.length === 0) return { value: null, previous: null, label: null };

  const minDepth = Math.min(...candidates.map((n) => n.depth));
  const chosen = candidates.filter((n) => n.depth === minDepth);

  const withValue = chosen.filter((n) => n.current !== null);
  if (withValue.length === 0) {
    return { value: null, previous: null, label: chosen[0].label };
  }
  if (withValue.length === 1) {
    return {
      value: withValue[0].current,
      previous: withValue[0].previous,
      label: withValue[0].label,
    };
  }

  const sum = withValue.reduce((acc, n) => acc + (n.current ?? 0), 0);
  const prevValues = withValue.filter((n) => n.previous !== null);
  const prevSum = prevValues.length > 0
    ? prevValues.reduce((acc, n) => acc + (n.previous ?? 0), 0)
    : null;
  return {
    value: sum,
    previous: prevSum,
    // Etykiety bez końcowego ", w tym:" i sklejone spójnikiem, żeby dało się
    // to przeczytać w interfejsie.
    label: withValue.map((n) => n.label.replace(/,?\s*w tym:?$/i, "")).join(" oraz "),
  };
}

const REVENUE_PATTERNS = [
  "przychody netto ze sprzeda",
  "przychody z dzialalnosci statutowej",
  "przychody z dzialalnosci gospodarczej",
  "przychody podstawowej dzialalnosci operacyjnej",
];

export function extractFinancials(doc: FinancialDocument): ExtractedFinancials {
  const nodes = flatten(doc.zawartosc);

  const revenue = pickShallowest(nodes, (label) =>
    REVENUE_PATTERNS.some((pattern) => label.startsWith(pattern)));

  const result = pickShallowest(nodes, (label) =>
    label.startsWith("zysk (strata) netto"));

  return {
    revenue: revenue.value,
    revenue_label: revenue.label,
    revenue_prev: revenue.previous,
    net_result: result.value,
    net_result_label: result.label,
    net_result_prev: result.previous,
  };
}

export interface DocumentGroup {
  data_start: string;
  data_koniec: string;
  dokumenty: { czy_ma_json: boolean; id: number; nazwa: string }[];
}

/**
 * Znajduje w grupie dokumentów rachunek zysków i strat dostępny w JSON.
 * Duże spółki raportujące według MSSF wrzucają jeden PDF "Roczne sprawozdanie
 * finansowe" bez wersji JSON. Wtedy zwracamy null i mówimy o tym wprost,
 * zamiast pobierać PDF, którego i tak nie sparsujemy.
 */
export function findProfitAndLossDocument(group: DocumentGroup): number | null {
  const match = group.dokumenty.find(
    (doc) => doc.czy_ma_json && /zysk/i.test(doc.nazwa),
  );
  return match?.id ?? null;
}
