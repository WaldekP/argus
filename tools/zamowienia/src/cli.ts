// CLI. Bez zaleznosci, reczne parsowanie argumentow.
//
//   node src/cli.ts ingest [--from-year 2020] [--to-year 2026] [--force]
//   node src/cli.ts status

import { openDb } from "./db.ts";
import { runIngest } from "./bzp.ts";
import { runStatus } from "./status.ts";

function parse(argv: string[]): { command: string; flags: Map<string, string | boolean> } {
  const [command = "help", ...rest] = argv;
  const flags = new Map<string, string | boolean>();
  for (let i = 0; i < rest.length; i++) {
    if (!rest[i].startsWith("--")) continue;
    const key = rest[i].slice(2);
    const next = rest[i + 1];
    if (next && !next.startsWith("--")) { flags.set(key, next); i++; }
    else flags.set(key, true);
  }
  return { command, flags };
}

const num = (f: Map<string, string | boolean>, k: string): number | undefined => {
  const v = f.get(k);
  return typeof v === "string" && Number.isFinite(Number(v)) ? Number(v) : undefined;
};

const HELP = `zamowienia: analiza zamowien publicznych Gdanska (BZP)

Komendy:
  ingest   pobiera ogloszenia BZP (o zamowieniu i o wyniku) dla Gdanska
           --from-year N | --to-year N | --force (pobierz ukonczone okna od nowa)
  status   skala danych, rozklad wg roku, najczestsi zwyciezcy

Wznawialne: przerwanie (Ctrl+C, restart) jest bezpieczne, stan w SQLite.
`;

async function main(): Promise<void> {
  const { command, flags } = parse(process.argv.slice(2));
  if (command === "help" || command === "--help") { console.log(HELP); return; }

  const db = openDb();
  try {
    if (command === "ingest") {
      await runIngest(db, {
        fromYear: num(flags, "from-year"),
        toYear: num(flags, "to-year"),
        force: flags.get("force") === true,
      });
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
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exitCode = 1;
});
