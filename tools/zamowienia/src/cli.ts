// CLI. Bez zaleznosci, reczne parsowanie argumentow.
//
//   node src/cli.ts ingest [--from-year 2020] [--to-year 2026] [--force]
//   node src/cli.ts status

import { openDb } from "./db.ts";
import { runIngest } from "./bzp.ts";
import { runStatus } from "./status.ts";
import { runOsoby } from "./osoby.ts";
import { runOcrDecl } from "./ocr-decl.ts";
import { runMatch } from "./match.ts";
import { runServe } from "./serve.ts";
import { runTed } from "./ted.ts";

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
  osoby    indeks urzednikow z oswiadczen majatkowych (nazwisko, rola, rok, PDF)
           --from-year N | --to-year N
  ted      ogloszenia TED (UE, duze kontrakty + historia) dla nabywcy + pliki XML
           --org "<nazwa nabywcy>" (wymagane) | --xml (pobierz pliki zrodlowe)
  ocr-decl rozczytuje skany oswiadczen (person_files) -> declaration_text (polski, wolne)
           --limit N
  match    liczy powiazania: deklaracje urzednikow <-> firmy-zwyciezcy -> tabela leads
  serve    lokalny frontend do przegladania zaleznosci (http://localhost:4319)
           --port N
  status   skala danych, rozklad wg roku, najczestsi zwyciezcy

Wznawialne: przerwanie (Ctrl+C, restart) jest bezpieczne, stan w SQLite.
`;

async function main(): Promise<void> {
  const { command, flags } = parse(process.argv.slice(2));
  if (command === "help" || command === "--help") { console.log(HELP); return; }

  // serve zarzadza wlasnymi polaczeniami read-only i dziala w petli — nie
  // otwieramy wspolnej (zapisywalnej) bazy ani jej nie zamykamy.
  if (command === "serve") {
    runServe(num(flags, "port") ?? 4319);
    return;
  }

  const db = openDb();
  try {
    if (command === "ingest") {
      await runIngest(db, {
        fromYear: num(flags, "from-year"),
        toYear: num(flags, "to-year"),
        force: flags.get("force") === true,
      });
    } else if (command === "osoby") {
      await runOsoby(db, { fromYear: num(flags, "from-year"), toYear: num(flags, "to-year") });
    } else if (command === "ted") {
      const org = typeof flags.get("org") === "string" ? String(flags.get("org")) : "";
      if (!org) {
        console.log('ted wymaga --org "<nazwa nabywcy>"');
        process.exitCode = 1;
      } else {
        await runTed(db, { buyer: org, downloadXml: flags.get("xml") === true });
      }
    } else if (command === "ocr-decl") {
      await runOcrDecl(db, { limit: num(flags, "limit") });
    } else if (command === "match") {
      runMatch(db);
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
