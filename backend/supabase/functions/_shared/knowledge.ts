// Ladowanie badan opinii publicznej (CBOS + ...) do globalnej tabeli
// knowledge_docs. Wejscie: rekordy z eksportu narzedzia tools/cbos-crawler.
// Embedding liczymy TU (Supabase.ai gte-small, tylko server-side), bo crawler
// w Node nie ma dostepu do modelu edge-runtime.
//
// Idempotentne: upsert po content_hash (sha256 tresci PDF). Ponowny przebieg
// crawlera z tymi samymi plikami nie tworzy duplikatow.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { embedText } from "./embeddings.ts";

export interface KnowledgeRecord {
  source: string;
  external_id: string;
  title: string;
  report_url?: string | null;
  pdf_url?: string | null;
  pub_date?: string | null;
  author?: string | null;
  year?: number | null;
  topic_tags?: string[];
  content_hash: string;
  summary?: string | null;
  structured?: Record<string, unknown> | null;
  text?: string | null;
}

export interface LoadResult {
  received: number;
  upserted: number;
  skipped: number;
  errors: Array<{ external_id: string; error: string }>;
}

// Tekst pod embedding: tytul + streszczenie + tresci pytan z badania.
// gte-small i tak przycina do ~512 tokenow, wiec skladamy najgestszy sygnal.
function embeddingInput(rec: KnowledgeRecord): string {
  const parts: string[] = [rec.title];
  if (rec.summary) parts.push(rec.summary);
  const badania = (rec.structured?.badania as Array<{ pytanie?: string }> | undefined) ?? [];
  for (const b of badania) if (b?.pytanie) parts.push(b.pytanie);
  return parts.join(". ").slice(0, 2000);
}

function topicSlugsOf(rec: KnowledgeRecord): string[] {
  const fromAi = rec.structured?.topicSlugs;
  if (Array.isArray(fromAi)) return fromAi.filter((s): s is string => typeof s === "string");
  return [];
}

/**
 * Wstawia porcje rekordow. Wywolujacy (argus-ingest) dzieli caly eksport na
 * porcje, bo limit workera Edge Functions nie przepusci setek PDF-ow naraz.
 */
export async function loadKnowledgeDocs(
  supabase: SupabaseClient,
  records: KnowledgeRecord[],
): Promise<LoadResult> {
  const result: LoadResult = { received: records.length, upserted: 0, skipped: 0, errors: [] };

  for (const rec of records) {
    if (!rec.content_hash || !rec.external_id || !rec.title) {
      result.skipped++;
      continue;
    }
    try {
      let embedding: number[] | null = null;
      const input = embeddingInput(rec);
      if (input.trim()) {
        embedding = await embedText(input);
      }

      const row = {
        source: rec.source,
        external_id: rec.external_id,
        title: rec.title,
        report_url: rec.report_url ?? null,
        pdf_url: rec.pdf_url ?? null,
        pub_date: rec.pub_date ?? null,
        author: rec.author ?? null,
        year: rec.year ?? null,
        topic_tags: rec.topic_tags ?? [],
        topic_slugs: topicSlugsOf(rec),
        summary: rec.summary ?? null,
        structured: rec.structured ?? {},
        content: rec.text ?? null,
        content_hash: rec.content_hash,
        embedding,
      };

      const { error } = await supabase
        .from("knowledge_docs")
        .upsert(row, { onConflict: "content_hash" });
      if (error) {
        result.errors.push({ external_id: rec.external_id, error: error.message });
      } else {
        result.upserted++;
      }
    } catch (err) {
      result.errors.push({
        external_id: rec.external_id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
