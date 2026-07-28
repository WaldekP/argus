// Konfiguracja domyslna. Wszystko do nadpisania flagami CLI.
//
// Wartosci grzecznosciowe sa celowo konserwatywne: cbos.pl to jeden host,
// wiec crawlujemy szeregowo z odstepem. robots.txt CBOS blokuje wylacznie
// /stats/, komunikaty (SPISKOM.POL, publikacje.php) sa dozwolone.

import path from "node:path";
import { fileURLToPath } from "node:url";

const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const config = {
  /** Katalog na baze, oryginaly PDF i logi. Poza gitem. */
  dataDir: path.join(toolRoot, "data"),
  dbPath: path.join(toolRoot, "data", "cbos.sqlite"),
  blobDir: path.join(toolRoot, "data", "blobs"),
  textDir: path.join(toolRoot, "data", "texts"),
  exportDir: path.join(toolRoot, "data", "export"),

  /** Host serwisu i sciezki listingu / archiwum PDF. */
  baseUrl: "https://www.cbos.pl",
  /** Listing komunikatow; okno przesuwane parametrem publikacje_offset. */
  listPath: "/PL/publikacje/publikacje.php",
  /** Strona pojedynczego komunikatu (metadane, link PDF). */
  reportPath: "/PL/publikacje/raporty_tekst.php",
  /**
   * Wzorzec bezposredniego PDF: /SPISKOM.POL/{ROK}/K_{NNN}_{RR}.PDF
   * gdzie NNN to numer komunikatu (3 cyfry, zero-padded), RR to dwie
   * ostatnie cyfry roku. Zweryfikowane na K_079_26.PDF (komunikat 79/2026).
   */
  pdfDir: "/SPISKOM.POL",

  userAgent:
    "ArgusCbosCrawler/0.1 (badawczy crawl komunikatow CBOS; kontakt: przemek@dietly.pl)",

  /** Odstep miedzy zadaniami do cbos.pl. Jeden host, wiec zawsze szeregowo. */
  requestDelayMs: 1500,
  requestTimeoutMs: 30_000,
  /** Twardy limit rozmiaru pojedynczego PDF. */
  maxDocBytes: 60 * 1024 * 1024,

  /** Najstarszy rocznik komunikatow do katalogowania (decyzja usera: 2016+). */
  minYear: 2016,
  /**
   * Krok okna listingu. Domyslny listing zwraca ~71 wpisow, a offset przesuwa
   * okno; krok mniejszy od okna + dedup po id (INSERT OR IGNORE) gwarantuje
   * brak dziur. 40 to bezpieczny zapas.
   */
  listOffsetStep: 40,
  /** Bezpiecznik: ile stron listingu maksymalnie przejsc w jednym discover. */
  maxListPages: 200,

  /**
   * Strukturyzacja (etap AI), dwustopniowa dla oszczednosci:
   *  1. gateModel (tani Haiku) ocenia na tytule + streszczeniu + poczatku
   *     tekstu, czy komunikat niesie dane merytoryczne do ktoregos tematu.
   *  2. anthropicModel (mocny Sonnet) wyciaga pola typu Badanie WYLACZNIE
   *     z komunikatow przepuszczonych przez gate. Dokladnosc liczb krytyczna.
   * Sonnet odpala sie tylko na ~20% wsadu, wiec pelny bieg jest ~5x tanszy.
   */
  gateModel: "claude-haiku-4-5-20251001",
  anthropicModel: "claude-sonnet-5",
  /** Ile znakow tekstu podajemy taniemu gate'owi (poczatek niesie metryczke i tezy). */
  gateMaxChars: 3500,
  anthropicApiUrl: "https://api.anthropic.com/v1/messages",
  anthropicVersion: "2023-06-01",
  /** Ile znakow tekstu komunikatu podajemy modelowi (poczatek niesie metryczke). */
  structureMaxChars: 24_000,
};

export type Config = typeof config;
