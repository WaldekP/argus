/**
 * Adapter archiwum programów publicystycznych TVN24: strona programu ->
 * ScrapedEpisode[] (kto był gościem, o czym była rozmowa, kiedy).
 *
 * Po co to jest: przygotowanie do wywiadu potrzebuje trzech rzeczy naraz,
 * a program dostarcza dwie z nich jednym pobraniem. Ostatnie tematy pokazują,
 * czym redakcja żyje w tym tygodniu, a lista gości pokazuje, jak prowadzący
 * ustawia rozmowę z politykiem danej formacji. Biogram prowadzącego mówi
 * o tym znacznie mniej niż dwadzieścia ostatnich odcinków.
 *
 * Ustalenia z rekonesansu (2026-09-17, zwykły User-Agent przeglądarki):
 *
 *   - `robots.txt` TVN24 blokuje dla wszystkich tylko `/_e/p/playlist/*`
 *     oraz `*?page=*`. Ścieżka `/plus/programy/*` jest dozwolona. Blokada
 *     paginacji oznacza, że dostajemy pierwszą stronę i nic głębiej, czyli
 *     dokładnie ostatnią serię odcinków. To ograniczenie akurat pokrywa się
 *     z tym, czego funkcja potrzebuje, więc nie próbujemy go obchodzić.
 *   - strona programu: `https://tvn24.pl/plus/programy/<slug>`, oddaje
 *     24 ostatnie odcinki (Kropka nad i, Jeden na jeden, Rozmowa Piaseckiego,
 *     Tak jest; Fakty po Faktach mniej, bo rzadziej trafiają do serwisu),
 *   - odcinek w liście: `<a href=".../<slug-tematu>-vc<id>" title="<goście>">`,
 *     gdzie atrybut `title` to imiona i nazwiska gości rozdzielone przecinkiem
 *     ("Anna Maria Żukowska, Katarzyna Lubnauer"), a slug w adresie niesie
 *     temat rozmowy,
 *   - strona odcinka ma JSON-LD `NewsArticle` z `headline` (temat),
 *     `datePublished` i `description` (lead, zwykle z cytatem gościa).
 *
 * Dlaczego atrybut `title` i JSON-LD, a nie selektory CSS: TVN24 renderuje
 * styled-components z losowanymi klasami ("sc-aXZVgy sc-gEvEery ldavXXy"),
 * które zmieniają się przy każdym buildzie. To samo ustalenie co w tvn24.ts.
 *
 * Moduł jest czysty (fetch plus regex), żeby działał i w Deno, i w Node.
 */

import { fetchText, sleep } from "./html.ts";

const HOST = "https://tvn24.pl";

/** Odstęp między żądaniami, żeby nie walić w serwis serią bez przerwy. */
const DELAY_MS = 400;

/** Ile odcinków bierzemy z jednego przebiegu. Strona i tak oddaje 24. */
export const DEFAULT_MAX_EPISODES = 24;

/** Program publicystyczny w archiwum. `slug` jest kluczem w adresie i w bazie. */
export interface ProgramSeed {
  source: "tvn24";
  slug: string;
  name: string;
  /** Prowadzący. Dla pasm z rotacją prowadzących lista bywa dłuższa. */
  hosts: string[];
  /** Pasmo antenowe, wpisane ręcznie: nie ma go w danych strony. */
  scheduleNote: string | null;
}

/** Odcinek wyciągnięty z archiwum. */
export interface ScrapedEpisode {
  /** Identyfikator u źródła (człon `vc<id>` w adresie), klucz deduplikacji. */
  externalId: string;
  url: string;
  /** Temat odcinka: nagłówek z JSON-LD, a gdy go brak, slug adresu. */
  title: string;
  /** Goście z atrybutu `title` w liście, po odjęciu tytułów grzecznościowych. */
  guests: string[];
  publishedAt: string | null;
  /** Lead odcinka, zwykle z cytatem gościa. */
  summary: string | null;
}

/**
 * Programy, które umiemy zaciągnąć. Prowadzących i pasmo wpisujemy ręcznie,
 * bo strona archiwum ich nie podaje, a zgadywanie z nazwy programu dałoby
 * dane, których nie da się obronić.
 */
export const PROGRAM_SEEDS: ProgramSeed[] = [
  {
    source: "tvn24",
    slug: "kropka-nad-i",
    name: "Kropka nad i",
    hosts: ["Monika Olejnik"],
    scheduleNote: "od poniedziałku do czwartku, 20:00",
  },
  {
    source: "tvn24",
    slug: "jeden-na-jeden",
    name: "Jeden na jeden",
    hosts: [],
    scheduleNote: null,
  },
  {
    source: "tvn24",
    slug: "rozmowa-piaseckiego",
    name: "Rozmowa Piaseckiego",
    hosts: ["Konrad Piasecki"],
    scheduleNote: null,
  },
  {
    source: "tvn24",
    slug: "tak-jest",
    name: "Tak jest",
    hosts: [],
    scheduleNote: null,
  },
  {
    source: "tvn24",
    slug: "fakty-po-faktach",
    name: "Fakty po Faktach",
    hosts: [],
    scheduleNote: null,
  },
];

export function programSeed(slug: string): ProgramSeed | null {
  return PROGRAM_SEEDS.find((seed) => seed.slug === slug) ?? null;
}

export function archiveUrl(seed: ProgramSeed): string {
  return `${HOST}/plus/programy/${seed.slug}`;
}

/**
 * Encje HTML i sekwencje \uXXXX. Osobno od tvn24.ts, bo tamten dekoder czyta
 * JSON-LD, a tutaj wchodzi też atrybut `title` z gołego HTML. Twarda spacja
 * musi zejść do zwykłej, inaczej "prof. Antoni Dudek" nie rozpada się
 * na tytuł i nazwisko.
 */
export function decodeEntities(value: string): string {
  return value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    // Leady TVN24 cytują gościa przez `&#34;`, a nie `&quot;`, więc encje
    // numeryczne muszą wejść ogólną regułą. Bez tego cytat w streszczeniu
    // odcinka wyglądał jak `&#34;powinniśmy naszą pomoc...&#34;`.
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/ /g, " ");
}

/**
 * Znaczniki z leadu odcinka. TVN24 wypisuje w nim listę pozostałych wątków
 * rozmowy, rozdzielając je `<br/>`, więc łamania zamieniamy na nowe linie,
 * a resztę znaczników usuwamy. Tekst idzie do UI i do promptu, nie do HTML.
 */
export function stripTags(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

/**
 * Tytuły grzecznościowe i zawodowe sprzed nazwiska. Zdejmujemy je, żeby ten
 * sam gość z dwóch odcinków ("Roman Giertych", "mec. Roman Giertych") był
 * jednym człowiekiem przy wyszukiwaniu.
 */
const HONORIFICS =
  /^(?:prof\.\s*dr\s+hab\.|dr\s+hab\.|prof\.|dr|mec\.|ks\.|gen\.|płk|ppłk|sen\.|min\.|red\.)\s+/i;

export function cleanGuestName(value: string): string {
  let name = decodeEntities(value).replace(/\s+/g, " ").trim();
  let previous = "";
  while (name !== previous) {
    previous = name;
    name = name.replace(HONORIFICS, "").trim();
  }
  return name;
}

/**
 * Goście z atrybutu `title`. Przecinek rozdziela osoby ("Arkadiusz Myrcha,
 * Waldemar Buda"). Wpisy bez spacji odrzucamy: to nie są imię i nazwisko,
 * tylko etykiety w rodzaju "Facebook" z nawigacji serwisu.
 */
export function parseGuests(titleAttr: string): string[] {
  return titleAttr
    .split(",")
    .map(cleanGuestName)
    .filter((name) => name.length >= 3 && name.includes(" "));
}

/** Temat z adresu odcinka, gdy strona odcinka nie odda nagłówka. */
export function titleFromSlug(url: string): string {
  const match = /\/([a-z0-9-]+)-vc\d+$/.exec(url);
  if (!match) return url;
  const words = match[1].replace(/-/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export interface EpisodeLink {
  externalId: string;
  url: string;
  guests: string[];
}

/**
 * Odcinki ze strony programu. Kolejność ze strony (najnowsze pierwsze)
 * zachowana, duplikaty (ten sam odcinek w kilku kafelkach) zwinięte.
 */
export function extractEpisodeLinks(html: string, programSlug: string): EpisodeLink[] {
  const found = new Map<string, EpisodeLink>();
  const re = new RegExp(
    `href="(?:${HOST})?(/plus/programy/${programSlug}/[a-z0-9-]+-vc(\\d+))"\\s+title="([^"]{2,200})"`,
    "g",
  );
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const [, path, externalId, titleAttr] = match;
    if (found.has(externalId)) continue;
    found.set(externalId, {
      externalId,
      url: `${HOST}${path}`,
      guests: parseGuests(titleAttr),
    });
  }
  return [...found.values()];
}

export interface EpisodeMeta {
  title: string | null;
  publishedAt: string | null;
  summary: string | null;
}

/**
 * Nagłówek, data i lead z JSON-LD strony odcinka. Czytamy pola pojedynczo
 * zamiast parsować cały blok, bo TVN24 wstawia na stronę także listę klipów
 * (`ItemList`), a JSON.parse całości wywraca się na jednym znaku ucieczki
 * w opisie i traciłby wtedy również datę.
 */
export function extractEpisodeMeta(html: string): EpisodeMeta {
  const pick = (field: string): string | null => {
    const re = new RegExp(`"${field}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`);
    const match = re.exec(html);
    if (!match) return null;
    const value = decodeEntities(match[1].replace(/\\"/g, '"').replace(/\\\//g, "/")).trim();
    return value.length > 0 ? value : null;
  };
  const summary = pick("description");
  return {
    title: pick("headline"),
    publishedAt: pick("datePublished"),
    summary: summary ? stripTags(summary) || null : null,
  };
}

export interface CrawlProgramOptions {
  maxEpisodes?: number;
  /** Odcinki już zapisane w bazie: nie dociągamy ich stron po raz drugi. */
  knownIds?: Set<string>;
}

/**
 * Pełny przebieg: strona programu, a potem strony odcinków po datę i lead.
 * Znane odcinki pomijamy, więc codzienny cron pobiera tylko nowe wejścia,
 * a nie całą listę od nowa.
 */
export async function crawlProgram(
  seed: ProgramSeed,
  opts: CrawlProgramOptions = {},
): Promise<ScrapedEpisode[]> {
  const maxEpisodes = opts.maxEpisodes ?? DEFAULT_MAX_EPISODES;
  const known = opts.knownIds ?? new Set<string>();

  const listing = await fetchText(archiveUrl(seed));
  if (!listing) return [];

  const links = extractEpisodeLinks(listing, seed.slug)
    .filter((link) => !known.has(link.externalId))
    .slice(0, maxEpisodes);

  const episodes: ScrapedEpisode[] = [];
  for (const link of links) {
    await sleep(DELAY_MS);
    const page = await fetchText(link.url);
    const meta = page
      ? extractEpisodeMeta(page)
      : { title: null, publishedAt: null, summary: null };
    episodes.push({
      externalId: link.externalId,
      url: link.url,
      title: meta.title ?? titleFromSlug(link.url),
      guests: link.guests,
      publishedAt: meta.publishedAt,
      summary: meta.summary,
    });
  }
  return episodes;
}
