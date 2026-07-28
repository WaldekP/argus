// CLI. Zero zaleznosci, wiec parsowanie argumentow jest reczne i proste.
//
//   node src/cli.ts discover  [--min-year 2016] [--max-pages N] [--delay ms]
//   node src/cli.ts crawl     [--limit N] [--delay ms] [--retry-errors]
//   node src/cli.ts extract   [--limit N] [--force]
//   node src/cli.ts structure [--limit N] [--model claude-...] [--force]
//   node src/cli.ts export    [--include-unusable] [--no-text]
//   node src/cli.ts status

import { openDb } from "./db.ts";
import { runDiscover } from "./discover.ts";
import { runCrawl } from "./crawl.ts";
import { runExtract } from "./extract.ts";
import { runStructure } from "./structure.ts";
import { runExport } from "./export.ts";
import { runUpload } from "./upload.ts";
import { runStatus } from "./status.ts";

function parseArgs(argv: string[]): {
  command: string;
  flags: Map<string, string | boolean>;
} {
  const [command = "help", ...rest] = argv;
  const flags = new Map<string, string | boolean>();
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = rest[i + 1];
    if (next && !next.startsWith("--")) {
      flags.set(key, next);
      i++;
    } else {
      flags.set(key, true);
    }
  }
  return { command, flags };
}

function num(flags: Map<string, string | boolean>, key: string): number | undefined {
  const v = flags.get(key);
  if (typeof v !== "string") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function str(flags: Map<string, string | boolean>, key: string): string | undefined {
  const v = flags.get(key);
  return typeof v === "string" ? v : undefined;
}

const HELP = `cbos-crawler: katalog, archiwum i strukturyzacja komunikatow CBOS pod baze wiedzy Argusa

Potok (w tej kolejnosci):
  discover   katalog komunikatow z listingu CBOS + filtr tematyczny (bez pobierania PDF)
             --min-year 2016 | --max-pages N | --delay ms
  crawl      pobranie PDF komunikatow dopasowanych do tematow, wznawialne (Ctrl+C ok)
             --limit N | --delay ms | --retry-errors
  extract    rozczytanie tekstu z PDF (pdfjs) do data/texts
             --limit N | --force
  structure  strukturyzacja tekstu w badanie opinii przez Claude API (wymaga CLAUDE_API_KEY)
             dwustopniowo: tani gate (Haiku) odsiewa, Sonnet wyciaga liczby z przydatnych
             --limit N | --model <id> | --gate-model <id> | --single-stage | --force
  export     zlozenie payloadu (data/export/cbos-knowledge.json) pod argus-ingest
             --include-unusable | --no-text
  upload     wyslanie eksportu do argus-ingest (load_knowledge) — po deployu
             --token <service_role|CRON_SECRET> (albo zmienna ARGUS_INGEST_TOKEN)
  status     postep per etap; mozna odpalac w trakcie z drugiego terminala

Uwaga: embeddingi liczy dopiero Edge Function argus-ingest (Supabase.ai, server-side).
`;

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));
  if (command === "help" || command === "--help") {
    console.log(HELP);
    return;
  }

  const db = openDb();
  try {
    if (command === "discover") {
      await runDiscover(db, {
        minYear: num(flags, "min-year"),
        maxPages: num(flags, "max-pages"),
        delayMs: num(flags, "delay"),
      });
    } else if (command === "crawl") {
      await runCrawl(db, {
        limit: num(flags, "limit"),
        delayMs: num(flags, "delay"),
        retryErrors: flags.get("retry-errors") === true,
      });
    } else if (command === "extract") {
      await runExtract(db, { limit: num(flags, "limit"), force: flags.get("force") === true });
    } else if (command === "structure") {
      await runStructure(db, {
        limit: num(flags, "limit"),
        model: str(flags, "model"),
        gateModel: str(flags, "gate-model"),
        singleStage: flags.get("single-stage") === true,
        force: flags.get("force") === true,
      });
    } else if (command === "export") {
      runExport(db, {
        includeUnusable: flags.get("include-unusable") === true,
        withText: flags.get("no-text") !== true,
      });
    } else if (command === "upload") {
      await runUpload({ token: str(flags, "token") });
    } else if (command === "status") {
      runStatus(db);
    } else {
      console.log(`Nieznana komenda: ${command}\n\n${HELP}`);
      process.exitCode = 1;
    }
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exitCode = 1;
});
