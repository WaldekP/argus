// CLI. Zero zaleznosci, wiec parsowanie argumentow jest reczne i proste.
//
//   node src/cli.ts registry [--terc 2261] [--place Gdansk]
//   node src/cli.ts probe [--entity 113387] [--force]
//   node src/cli.ts crawl [--entity 113387] [--max-pages 300] [--max-depth 4]
//                         [--delay 1500] [--include-old]
//   node src/cli.ts status [--verbose]

import { openDb } from "./db.ts";
import { runRegistry } from "./registry.ts";
import { runProbe } from "./probe.ts";
import { runCrawl } from "./crawl.ts";
import { runStatus } from "./status.ts";
import { runExtract } from "./extract.ts";
import { runIndex, runSearch } from "./search.ts";

function parseArgs(argv: string[]): {
  command: string;
  flags: Map<string, string | boolean>;
  positional: string[];
} {
  const [command = "help", ...rest] = argv;
  const flags = new Map<string, string | boolean>();
  const positional: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = rest[i + 1];
    if (next && !next.startsWith("--")) {
      flags.set(key, next);
      i++;
    } else {
      flags.set(key, true);
    }
  }
  return { command, flags, positional };
}

function num(flags: Map<string, string | boolean>, key: string): number | undefined {
  const v = flags.get(key);
  if (typeof v !== "string") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

const HELP = `bip-scraper: lokalne mapowanie i archiwizacja stron BIP

Komendy (w tej kolejnosci przy pierwszym uzyciu):
  registry   pobiera spis podmiotow BIP z gov.pl i filtruje (domyslnie Gdansk, TERC 2261)
             --terc 2261 | --place Gdansk
  probe      bada kazdy podmiot: platforma CMS, robots.txt, sitemapa, RSS
             --entity <id> | --force (ponowne badanie wszystkich)
  crawl      wlasciwy crawl: strony + dokumenty do data/blobs, wznawialny (Ctrl+C bezpieczne)
             --entity <id> | --max-pages N | --max-depth N | --delay ms | --include-old
  extract    rozczytanie tekstu z archiwum (PDF, DOCX, HTML) do data/texts;
             skany bez warstwy tekstowej dostaja status needs_ocr (kolejka pod OCR)
             --limit N | --force (przeliczenie wszystkiego od nowa)
  index      (prze)budowa indeksu pelnotekstowego z rozczytanych dokumentow
  search     szukanie po tresci i tytulach, np.: search "wycinka drzew" --limit 20
  status     postep per podmiot; mozna odpalac w trakcie crawla z drugiego terminala
             --verbose (pelna lista + rozklad platform)
  reset      zeruje stan STRON podmiotu (crawl od nowa); archiwum dokumentow zostaje,
             wiec nic nie jest pobierane ani rozczytywane drugi raz
             --entity <id> (wymagane)
`;

async function main(): Promise<void> {
  const { command, flags, positional } = parseArgs(process.argv.slice(2));
  if (command === "help" || command === "--help") {
    console.log(HELP);
    return;
  }

  const db = openDb();
  try {
    if (command === "registry") {
      await runRegistry(db, {
        tercPrefix: typeof flags.get("terc") === "string" ? String(flags.get("terc")) : undefined,
        place: typeof flags.get("place") === "string" ? String(flags.get("place")) : undefined,
      });
    } else if (command === "probe") {
      await runProbe(db, { entityId: num(flags, "entity"), force: flags.get("force") === true });
    } else if (command === "crawl") {
      await runCrawl(db, {
        entityId: num(flags, "entity"),
        maxPages: num(flags, "max-pages"),
        maxDepth: num(flags, "max-depth"),
        delayMs: num(flags, "delay"),
        includeOld: flags.get("include-old") === true,
      });
    } else if (command === "extract") {
      await runExtract(db, { limit: num(flags, "limit"), force: flags.get("force") === true });
    } else if (command === "index") {
      runIndex(db);
    } else if (command === "search") {
      runSearch(db, positional.join(" "), num(flags, "limit") ?? 10);
    } else if (command === "status") {
      runStatus(db, flags.get("verbose") === true);
    } else if (command === "reset") {
      const entityId = num(flags, "entity");
      if (!entityId) {
        console.log("reset wymaga --entity <id>");
        process.exitCode = 1;
      } else {
        // Tylko strony i dokumenty NIE pobrane. Zapisane oryginaly i ich
        // metadane zostaja: ponowny crawl znajdzie te same URL-e, a INSERT
        // OR IGNORE nie tknie istniejacych wierszy documents.
        const pages = db.prepare("DELETE FROM pages WHERE entity_id = ?").run(entityId);
        const docs = db
          .prepare("DELETE FROM documents WHERE entity_id = ? AND status = 'pending'")
          .run(entityId);
        console.log(
          `Wyzerowano: ${pages.changes} stron, ${docs.changes} niepobranych dokumentow. ` +
            "Zapisane dokumenty nietkniete.",
        );
      }
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
