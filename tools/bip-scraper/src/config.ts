// Konfiguracja domyslna. Wszystko do nadpisania flagami CLI.
//
// Wartosci grzecznosciowe sa celowo konserwatywne: czesc BIP-ow stoi na
// wspoldzielonym hostingu i agresywny crawl potrafi je polozyc.

import path from "node:path";
import { fileURLToPath } from "node:url";

const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const config = {
  /** Katalog na baze, oryginaly dokumentow i logi. Poza gitem. */
  dataDir: path.join(toolRoot, "data"),
  dbPath: path.join(toolRoot, "data", "bip.sqlite"),
  blobDir: path.join(toolRoot, "data", "blobs"),
  logPath: path.join(toolRoot, "data", "crawl.log"),

  /** Spis podmiotow BIP: ZIP z subjects.xml w srodku. */
  registryUrl: "https://www.gov.pl/web/bip/spis",

  /** Domyslny filtr rejestru: TERC Gdanska (miasto na prawach powiatu). */
  tercPrefix: "2261",

  userAgent: "ArgusBipScraper/0.1 (badawczy crawl BIP; kontakt: przemek@dietly.pl)",

  /** Odstep miedzy zadaniami do tego samego hosta. */
  perHostDelayMs: 1500,
  /** Ile hostow obslugiwanych rownolegle. Per host zawsze szeregowo. */
  hostConcurrency: 4,

  requestTimeoutMs: 30_000,

  /** Granice crawla per podmiot. */
  maxDepth: 4,
  maxPagesPerEntity: 300,
  /** Limit adresow zasianych z sitemapy per podmiot. */
  maxSitemapUrls: 2000,

  /** Dokumenty starsze (wg Last-Modified) niz tyle dni: metadane tak, plik nie. */
  maxAgeDays: 730,

  /**
   * Najstarszy rocznik aktow pobierany z Bazy Aktow Wlasnych Urzedu Miasta
   * (baw.bip.gdansk.pl). Decyzja usera 2026-07-25: UM ograniczony do ostatnich
   * 6 lat. Uzywane przez adapter BAW przy filtrze `Rok`.
   */
  bawMinYear: new Date().getUTCFullYear() - 6,
  /** Twardy limit rozmiaru pojedynczego pliku. */
  maxDocBytes: 50 * 1024 * 1024,

  /** Rozszerzenia traktowane jako dokument do pobrania. */
  docExtensions: /\.(pdf|docx?|xlsx?|odt|ods|rtf|csv|pptx?)(?=$|[?#])/i,
};

export type Config = typeof config;
