// Wyszukiwanie badan opinii publicznej (knowledge_docs, zrodlo CBOS + ...)
// pod grounding odpowiedzi AI. Embedduje zapytanie (gte-small), odpytuje RPC
// match_knowledge_docs i sklada zwiezly blok kontekstu z wynikami i zrodlem.
//
// Zasada: FAIL-SOFT. To wzbogacenie, nie zaleznosc — gdy tabela jest pusta,
// jeszcze nie istnieje (migracja niewdrozona) albo embedding padnie, zwracamy
// pusty string i wywolujacy dziala dalej bez danych sondazowych.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { embedText } from "./embeddings.ts";

interface Wynik {
  etykieta?: string;
  procent?: number;
  kluczowy?: boolean;
}
interface BadanieItem {
  pytanie?: string;
  jakCzytac?: string;
  wyniki?: Wynik[];
}
interface Structured {
  termin?: string | null;
  proba?: string | null;
  zleceniodawca?: string | null;
  badania?: BadanieItem[];
}
interface MatchRow {
  source: string;
  external_id: string;
  title: string;
  pub_date: string | null;
  summary: string | null;
  structured: Structured | null;
  topic_slugs: string[] | null;
  similarity: number;
}

export interface OpinionSearchOptions {
  /** Ile komunikatow najwyzej dolaczyc. */
  limit?: number;
  /** Prog podobienstwa cosinusowego (gte-small jest slaby, wiec konserwatywnie). */
  minSimilarity?: number;
  /** Zawezenie do jednego tematu Argusa (slug), gdy znany z kontekstu. */
  topicSlug?: string;
  /** Ile pytan z jednego komunikatu pokazac. */
  questionsPerDoc?: number;
}

/**
 * Zwraca gotowy blok tekstu do wstrzykniecia w prompt (albo "" gdy brak
 * trafien / blad). Cytowalny: nazwa CBOS, numer, data, pytania i rozklady.
 */
export async function searchOpinionContext(
  supabase: SupabaseClient,
  query: string,
  opts: OpinionSearchOptions = {},
): Promise<string> {
  const limit = opts.limit ?? 4;
  const minSimilarity = opts.minSimilarity ?? 0.35;
  const questionsPerDoc = opts.questionsPerDoc ?? 3;

  try {
    if (!query.trim()) return "";
    const embedding = await embedText(query);
    const { data, error } = await supabase.rpc("match_knowledge_docs", {
      p_query_embedding: embedding,
      p_topic_slug: opts.topicSlug ?? null,
      p_limit: Math.min(Math.max(limit * 2, limit), 20),
    });
    if (error || !Array.isArray(data)) return "";

    const rows = (data as MatchRow[])
      .filter((r) => typeof r.similarity === "number" && r.similarity >= minSimilarity)
      .slice(0, limit);
    if (rows.length === 0) return "";

    const blocks = rows.map((r, i) => formatDoc(r, i + 1, questionsPerDoc));
    return (
      "## Dane sondażowe (CBOS) — użyj, jeśli pasują do pytania\n\n" +
      "Poniżej wyniki badań opinii dopasowane do rozmowy. Powołuj się na nie z podaniem źródła i daty " +
      '(np. „CBOS, lipiec 2026"). Nie podawaj liczb spoza tej listy jako danych CBOS.\n\n' +
      blocks.join("\n\n")
    );
  } catch {
    return "";
  }
}

function formatDoc(r: MatchRow, idx: number, questionsPerDoc: number): string {
  const date = r.pub_date ?? "brak daty";
  const lines: string[] = [`[${idx}] ${r.source} nr ${r.external_id} (${date}) — ${r.title}`];

  const s = r.structured ?? {};
  if (s.termin || s.proba) {
    lines.push(`    Badanie: ${[s.termin, s.proba].filter(Boolean).join("; ")}`.slice(0, 300));
  }

  const badania = Array.isArray(s.badania) ? s.badania.slice(0, questionsPerDoc) : [];
  for (const b of badania) {
    if (!b?.pytanie) continue;
    const wyniki = (Array.isArray(b.wyniki) ? b.wyniki : [])
      .slice(0, 6)
      .map((w) => `${w.procent ?? "?"}% ${w.etykieta ?? ""}`.trim())
      .join(", ");
    lines.push(`    • ${truncate(b.pytanie, 180)}${wyniki ? ` → ${truncate(wyniki, 220)}` : ""}`);
  }

  if (badania.length === 0 && r.summary) {
    lines.push(`    ${truncate(r.summary, 240)}`);
  }
  return lines.join("\n");
}

function truncate(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}
