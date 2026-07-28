/**
 * Klient Edge Function `argus-knowledge`: globalna baza badań opinii publicznej
 * (tabela `knowledge_docs`, źródło CBOS, zasilana z tools/cbos-crawler przez
 * argus-ingest). Ekrany: Dane → Badania opinii oraz sekcja badań na /temat/[slug].
 */

import { edgeClient } from '@/lib/api/client';

/** Jeden wynik pytania sondażowego. */
export type BadanieWynik = {
  etykieta: string;
  procent: number | null;
  kluczowy?: boolean;
};

/** Pojedyncze pytanie badania z rozkładem odpowiedzi. */
export type BadaniePytanie = {
  pytanie: string;
  jakCzytac?: string | null;
  wyniki: BadanieWynik[];
};

/** Ustrukturyzowane badanie (pole `structured` w knowledge_docs). */
export type BadanieStructured = {
  przydatny?: boolean;
  uzasadnienie?: string;
  topicSlugs?: string[];
  termin?: string | null;
  proba?: string | null;
  zleceniodawca?: string | null;
  badania?: BadaniePytanie[];
};

/** Badanie na liście (operation: list_knowledge_docs). */
export type KnowledgeDocListItem = {
  id: string;
  source: string;
  external_id: string;
  title: string;
  pub_date: string | null;
  topic_slugs: string[];
  question_count: number;
};

/** Pełny rekord badania (operation: get_knowledge_doc). */
export type KnowledgeDoc = {
  id: string;
  source: string;
  external_id: string;
  title: string;
  report_url: string | null;
  pdf_url: string | null;
  pub_date: string | null;
  author: string | null;
  year: number | null;
  topic_tags: string[];
  topic_slugs: string[];
  summary: string | null;
  structured: BadanieStructured | null;
};

type KnowledgeOperation = 'list_knowledge_docs' | 'get_knowledge_doc';

const callKnowledge = edgeClient<KnowledgeOperation>('argus-knowledge');

/**
 * Lista badań z bazy globalnej; grupowanie/filtr po stronie ekranu.
 * `topicSlug` zawęża do jednego tematu Argusa (używane na /temat/[slug]).
 */
export async function listKnowledgeDocs(topicSlug?: string): Promise<KnowledgeDocListItem[]> {
  const data = await callKnowledge<{ docs: KnowledgeDocListItem[] }>(
    'list_knowledge_docs',
    topicSlug ? { topic_slug: topicSlug } : {},
  );
  return data.docs;
}

/** Pełne badanie z pytaniami i rozkładami, pod ekran szczegółu. */
export async function getKnowledgeDoc(id: string): Promise<KnowledgeDoc> {
  const data = await callKnowledge<{ doc: KnowledgeDoc }>('get_knowledge_doc', { id });
  return data.doc;
}
