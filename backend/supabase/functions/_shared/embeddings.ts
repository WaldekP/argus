// Embeddingi tekstu przez wbudowane Supabase.ai (model gte-small, wymiar 384).
// Dziala wylacznie w Edge Functions (Deno) — bez zewnetrznego klucza API.
// Uwaga (odnotowane w kontrakcie): gte-small jest trenowany na angielskim,
// dla polskiego dziala slabiej; wymiana modelu = nowa migracja + re-embed.

// Minimalna deklaracja globalnego API Supabase.ai (edge-runtime).
declare const Supabase: {
  ai: {
    Session: new (model: string) => {
      run(
        input: string,
        options?: { mean_pool?: boolean; normalize?: boolean },
      ): Promise<number[]>;
    };
  };
};

export const EMBEDDING_DIM = 384;

// gte-small przycina do 512 tokenow; dluzsze teksty tylko psuja srednia.
const MAX_INPUT_CHARS = 1600;

let session: InstanceType<typeof Supabase.ai.Session> | null = null;

function getSession() {
  if (!session) {
    session = new Supabase.ai.Session("gte-small");
  }
  return session;
}

function truncate(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > MAX_INPUT_CHARS ? clean.slice(0, MAX_INPUT_CHARS) : clean;
}

// Embedding pojedynczego tekstu. Rzuca, gdy tekst pusty.
export async function embedText(text: string): Promise<number[]> {
  const input = truncate(text);
  if (!input) {
    throw new Error("Nie mozna policzyc embeddingu pustego tekstu");
  }
  const output = await getSession().run(input, {
    mean_pool: true,
    normalize: true,
  });
  const vector = Array.from(output);
  if (vector.length !== EMBEDDING_DIM) {
    throw new Error(
      `Nieoczekiwany wymiar embeddingu: ${vector.length} (oczekiwano ${EMBEDDING_DIM})`,
    );
  }
  return vector;
}

// Embeddingi wsadowe: sekwencyjnie z mala rownolegloscia (model lokalny
// w edge runtime; zbyt duza rownoleglosc nie przyspiesza, a zjada pamiec).
export async function embedBatch(
  texts: string[],
  concurrency = 4,
): Promise<number[][]> {
  const results: number[][] = new Array(texts.length);
  let next = 0;

  async function worker() {
    while (next < texts.length) {
      const i = next++;
      results[i] = await embedText(texts[i]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, texts.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}
