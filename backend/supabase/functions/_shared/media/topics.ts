// Slownik kontrolowany tematow pod brief polityczny.
//
// Surowe tagi/sekcje portali sa chaotyczne, wiec kazdy adapter mapuje je na
// ten zamkniety zbior. Dzieki temu da sie filtrowac "kto pisze o podatkach"
// niezaleznie od tego, jak dane medium nazywa swoja sekcje.

export const TOPICS = [
  "polityka krajowa",
  "Sejm/Senat",
  "samorzad",
  "gospodarka",
  "podatki i budzet",
  "energetyka",
  "zdrowie",
  "edukacja",
  "zagranica/UE",
  "bezpieczenstwo/obronnosc",
  "wymiar sprawiedliwosci",
  "sprawy spoleczne",
  "media",
] as const;

export type Topic = (typeof TOPICS)[number];

// Slowa-klucze (w mianowniku i typowych odmianach) -> temat. Dopasowanie po
// zawieraniu, bez diakrytykow, na lowercase. Kolejnosc bez znaczenia.
const KEYWORDS: Array<[Topic, string[]]> = [
  ["podatki i budzet", ["podatek", "podatk", "budzet", "vat", "pit", "cit", "danin", "skarbow", "fiskus", "skladk"]],
  ["gospodarka", ["gospodark", "ekonom", "inflacj", "firm", "biznes", "gielda", "przedsiebiorc", "rynek", "pln", "zloteg"]],
  ["energetyka", ["energetyk", "energi", "atom", "wegiel", "gaz", "prad", "oze", "elektrown", "cen pradu"]],
  ["Sejm/Senat", ["sejm", "senat", "poslank", "posel", "poslow", "senator", "ustaw", "glosowani", "komisj sejmow"]],
  ["wymiar sprawiedliwosci", ["sad", "prokurator", "trybunal", "krs", "wymiar sprawiedliwosci", "sledzt", "sledcz", "kryminal", "przestepstw", "sluzb"]],
  ["zagranica/UE", ["swiat", "zagranic", "unia europejsk", "ue", "bruksel", "nato", "usa", "ukrain", "rosj", "niemcy", "kreml"]],
  ["bezpieczenstwo/obronnosc", ["wojsk", "obronnos", "obrony", "armi", "mon", "granic", "bezpieczenstw"]],
  ["zdrowie", ["zdrowi", "szpital", "nfz", "lekarz", "pacjent", "medyc", "epidemi"]],
  ["edukacja", ["edukacj", "szkol", "oswiat", "nauczyciel", "matur", "uczni", "student", "uczeln"]],
  ["samorzad", ["samorzad", "prezydent miast", "rada miast", "wojewod", "gmin", "powiat", "ratusz", "referendum lokal"]],
  ["sprawy spoleczne", ["spolecz", "500 plus", "800 plus", "emerytur", "rent", "zus", "mieszkani", "protest", "zwiazk zawodow"]],
  ["media", ["media", "dziennikarstw", "telewizj", "tvp", "redakcj", "publicystyk"]],
  ["polityka krajowa", ["polityk", "rzad", "premier", "prezydent", "partia", "koalicj", "opozycj", "wybory", "minister"]],
];

function deburr(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l"); // l z kreska (l) nie rozklada sie w NFD
}

// Sekcje URL portali -> temat (szybka sciezka, zanim wejdzie analiza tekstu).
const SECTION_MAP: Record<string, Topic> = {
  kraj: "polityka krajowa",
  polityka: "polityka krajowa",
  swiat: "zagranica/UE",
  gospodarka: "gospodarka",
  biznes: "gospodarka",
  zdrowie: "zdrowie",
  nauka: "edukacja",
};

export function topicFromSection(section: string): Topic | null {
  return SECTION_MAP[deburr(section)] ?? null;
}

// Wyciaga tematy z dowolnego tekstu (bio, tytuly artykulow). Zwraca unikalne
// tematy w kolejnosci slownika, zeby wynik byl deterministyczny.
export function topicsFromText(text: string): Topic[] {
  const hay = deburr(text);
  const found = new Set<Topic>();
  for (const [topic, words] of KEYWORDS) {
    if (words.some((w) => hay.includes(w))) found.add(topic);
  }
  return TOPICS.filter((t) => found.has(t));
}

// Laczy sygnaly (sekcje artykulow + tekst) w jedna liste tematow.
export function mergeTopics(sections: string[], text: string): Topic[] {
  const found = new Set<Topic>();
  for (const s of sections) {
    const t = topicFromSection(s);
    if (t) found.add(t);
  }
  for (const t of topicsFromText(text)) found.add(t);
  return TOPICS.filter((t) => found.has(t));
}
