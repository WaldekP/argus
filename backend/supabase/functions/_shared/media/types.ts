// Wspolny ksztalt danych dziennikarza wyciagnietego ze strony redakcji.
// Kazdy adapter medium (onet.ts, tvn24.ts, ...) zwraca ScrapedJournalist[].
// Zapis do bazy (mapowanie na tabele journalists) robi warstwa nad adapterami,
// zeby logika parsowania byla czysta i testowalna w Node i Deno.

export type EmailStatus = "public" | "pattern" | "verified" | "none";

export interface ScrapedJournalist {
  fullName: string;
  // Slug profilu w obrebie outletu, stabilny klucz deduplikacji (patrz migracja).
  outletAuthorSlug: string;
  authorUrl: string;
  role: string | null;
  email: string | null;
  emailStatus: EmailStatus;
  bio: string | null;
  // Tematy zmapowane na slownik kontrolowany (patrz media/topics.ts).
  topics: string[];
  // { x: "https://x.com/...", ... }
  socials: Record<string, string>;
  // Strony, z ktorych powstal rekord (dowod publicznego zrodla, RODO).
  sourceUrls: string[];
  // Ostatnie materialy autora -> do journalist_materials i embeddingu.
  articleUrls: string[];
}
