// Etap 6 (opcjonalny): upload — wyslanie eksportu do Edge Function argus-ingest
// (operacja load_knowledge), ktora liczy embeddingi i wstawia do knowledge_docs.
//
// Autoryzacja: token service_role ALBO CRON_SECRET, podawany AD HOC przez
// zmienna ARGUS_INGEST_TOKEN lub flage --token — NIGDY z repo .env, bo klucz
// service_role jest sekretem Edge Functions (patrz .env.example). URL projektu
// bierzemy z EXPO_PUBLIC_SUPABASE_URL (repo .env).
//
// Dziala dopiero PO wypchnieciu migracji knowledge_docs i deployu argus-ingest.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.ts";

const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(toolRoot, "..", "..");

/** Rozmiar porcji: musi byc <= limitu operacji load_knowledge (50). */
const BATCH = 40;

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

  for (let i = 0; i < records.length; i += BATCH) {
    const chunk = records.slice(i, i + BATCH);
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
    if (!res.ok || !json.ok) {
      throw new Error(`Porcja ${i / BATCH + 1}: HTTP ${res.status} ${json.error ?? ""}`);
    }
    upserted += json.data?.upserted ?? 0;
    skipped += json.data?.skipped ?? 0;
    if (json.data?.errors?.length) errors.push(...json.data.errors);
    console.log(`  porcja ${Math.floor(i / BATCH) + 1}: upserted=${json.data?.upserted ?? 0}`);
  }

  console.log(`\nGotowe: upserted=${upserted}, skipped=${skipped}, bledow=${errors.length}`);
  for (const e of errors.slice(0, 10)) console.log(`  ! ${e.external_id}: ${e.error}`);
}
