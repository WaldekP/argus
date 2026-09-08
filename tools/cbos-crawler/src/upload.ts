// Etap 6 (opcjonalny): upload — wyslanie eksportu do Edge Function argus-ingest
// (operacja load_knowledge), ktora liczy embeddingi i wstawia do knowledge_docs.
//
// Autoryzacja: token service_role ALBO CRON_SECRET, podawany AD HOC przez
// zmienna ARGUS_INGEST_TOKEN lub flage --token — NIGDY z repo .env, bo klucz
// service_role jest sekretem Edge Functions (patrz .env.example).
//
// UWAGA: argus-ingest porownuje token doslownie z SUPABASE_SERVICE_ROLE_KEY
// wstrzykiwanym do funkcji, a projekt ma juz nowe klucze API, wiec pasuje
// klucz `sb_secret_...` z zakladki API Keys, a NIE stary service_role w postaci
// JWT. Stary klucz konczy sie odpowiedzia 403. URL projektu
// bierzemy z EXPO_PUBLIC_SUPABASE_URL (repo .env).
//
// Dziala dopiero PO wypchnieciu migracji knowledge_docs i deployu argus-ingest.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.ts";

const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(toolRoot, "..", "..");

/**
 * Rozmiar porcji. Limit operacji load_knowledge to 50 rekordow, ale nie o niego
 * tu chodzi: jeden rekord CBOS wazy okolo 28 kB (pelny tekst komunikatu),
 * a Edge Function liczy embeddingi po stronie serwera. Porcja po 40 konczyla
 * sie HTTP 503, po 5 bledem WORKER_RESOURCE_LIMIT. Trojka przechodzi
 * z zapasem, a caly korpus i tak wchodzi w mniej niz minute.
 */
const BATCH = 3;

function loadRepoEnv(): void {
  const envPath = path.join(repoRoot, ".env");
  if (fs.existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
    } catch {
      /* ignoruj */
    }
  }
}

export interface UploadOptions {
  token?: string;
}

export async function runUpload(opts: UploadOptions): Promise<void> {
  loadRepoEnv();

  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!baseUrl) {
    throw new Error("Brak EXPO_PUBLIC_SUPABASE_URL (repo .env).");
  }
  const token = opts.token ?? process.env.ARGUS_INGEST_TOKEN;
  if (!token) {
    throw new Error(
      "Brak tokena. Podaj --token <service_role|CRON_SECRET> albo zmienna ARGUS_INGEST_TOKEN. " +
        "NIE trzymaj klucza service_role w repo .env.",
    );
  }

  const exportPath = path.join(config.exportDir, "cbos-knowledge.json");
  if (!fs.existsSync(exportPath)) {
    throw new Error(`Brak eksportu ${exportPath}. Najpierw: export.`);
  }
  const parsed = JSON.parse(fs.readFileSync(exportPath, "utf8")) as {
    records: unknown[];
  };
  const records = parsed.records ?? [];
  if (records.length === 0) {
    console.log("Eksport pusty — nic do wyslania.");
    return;
  }

  const endpoint = `${baseUrl.replace(/\/$/, "")}/functions/v1/argus-ingest`;
  console.log(`Wysylam ${records.length} rekordow do ${endpoint} porcjami po ${BATCH}...`);

  let upserted = 0;
  let skipped = 0;
  const errors: Array<{ external_id: string; error: string }> = [];

  interface SendResult {
    ok: boolean;
    status: number;
    upserted: number;
    skipped: number;
    errors: typeof errors;
    error?: string;
  }

  async function send(chunk: unknown[]): Promise<SendResult> {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: token,
        "content-type": "application/json",
      },
      body: JSON.stringify({ operation: "load_knowledge", records: chunk }),
      signal: AbortSignal.timeout(300_000),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      data?: { upserted: number; skipped: number; errors: typeof errors };
    };
    return {
      ok: res.ok && json.ok === true,
      status: res.status,
      upserted: json.data?.upserted ?? 0,
      skipped: json.data?.skipped ?? 0,
      errors: json.data?.errors ?? [],
      error: json.error,
    };
  }

  function absorb(result: SendResult): void {
    upserted += result.upserted;
    skipped += result.skipped;
    if (result.errors.length) errors.push(...result.errors);
  }

  const total = Math.ceil(records.length / BATCH);

  for (let i = 0; i < records.length; i += BATCH) {
    const chunk = records.slice(i, i + BATCH);
    const nr = Math.floor(i / BATCH) + 1;

    const first = await send(chunk);
    if (first.ok) {
      absorb(first);
      console.log(`  porcja ${nr}/${total}: upserted=${first.upserted}`);
      continue;
    }

    // Worker Edge Functions potrafi paść na pamięci (HTTP 546
    // WORKER_RESOURCE_LIMIT albo 503), bo liczy embeddingi dla całych
    // komunikatów. To nie powód, żeby przerwać cały załadunek: schodzimy do
    // pojedynczych rekordów, dajemy workerowi chwilę na restart i lecimy
    // dalej. Wcześniej pierwszy taki błąd wywracał bieg i korpus wchodził do
    // bazy w kilkunastu procentach.
    console.log(`  porcja ${nr}/${total}: HTTP ${first.status}, probuje pojedynczo`);
    for (const record of chunk) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const single = await send([record]);
      if (single.ok) {
        absorb(single);
        continue;
      }
      const id = (record as { external_id?: string }).external_id ?? "?";
      errors.push({
        external_id: id,
        error: `HTTP ${single.status} ${single.error ?? ""}`.trim(),
      });
    }
  }

  console.log(`\nGotowe: upserted=${upserted}, skipped=${skipped}, bledow=${errors.length}`);
  for (const e of errors.slice(0, 10)) console.log(`  ! ${e.external_id}: ${e.error}`);
}
