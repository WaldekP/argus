// Konfiguracja. Wszystko do nadpisania flagami CLI.

import path from "node:path";
import { fileURLToPath } from "node:url";

const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const config = {
  dataDir: path.join(toolRoot, "data"),
  dbPath: path.join(toolRoot, "data", "zamowienia.sqlite"),

  /** API BZP (Biuletyn Zamowien Publicznych) na platformie e-Zamowienia. */
  bzpBase: "https://ezamowienia.gov.pl/mo-board/api/v1/notice",

  /** API TED (Tenders Electronic Daily, UE) — ogloszenia powyzej progow UE. */
  tedBase: "https://api.ted.europa.eu/v3/notices/search",
  /** Katalog na pobrane pliki zrodlowe XML z TED. */
  tedDir: path.join(toolRoot, "data", "ted"),

  /**
   * Filtr terytorialny: dokladna nazwa miasta zamawiajacego. API filtruje po
   * fragmencie (lapie "Starogard Gdanski"), wiec dokladne dopasowanie robimy
   * w kodzie.
   */
  city: "Gdańsk",

  /** Typy ogloszen: o zamowieniu (start) i o wyniku (zwyciezca). */
  noticeTypes: ["ContractNotice", "TenderResultNotice"] as const,

  /** Domyslny zakres historii, gdy nie podano flag. */
  defaultFromYear: 2020,

  userAgent: "ArgusZamowienia/0.1 (analiza zamowien publicznych; kontakt: przemek@dietly.pl)",
  requestTimeoutMs: 30_000,
  /** Odstep miedzy zadaniami do API, grzecznosciowo. */
  delayMs: 400,
  /** Rekordow na strone (API przyjmuje duze wartosci). */
  pageSize: 100,
};

export type Config = typeof config;
