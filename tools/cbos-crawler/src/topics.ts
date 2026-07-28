// Filtr tematyczny: mapuje komunikat CBOS na tematy programowe Argusa.
//
// To PREfiltr o wysokiej czulosci (lepiej wpuscic za duzo niz przegapic):
// dopasowanie po slowach w tytule i streszczeniu. Wlasciwa ocena przydatnosci
// i wyciagniecie liczb naleza do etapu strukturyzacji (AI) i przegladu
// czlowieka. Klastry pokrywaja sie z rodzinami tematow z knowledge/topics/.
//
// Dwa tryby dopasowania, bo naiwny substring daje falszywe trafienia
// (klasyk: "atom"/"nato" siedza w srodku slowa "Natomiast"):
//   - stems: rdzen od granicy slowa, otwarty z konca (podatk -> podatku,
//     podatkowy). Poprzedzony musi byc nie-litera/nie-cyfra.
//   - words: cale slowo, obie granice (NATO, OZE, PIT, UE, ETS) — inaczej
//     tona w przypadkowych podlancuchach.

export interface TematCluster {
  /** Tag zapisywany do bazy i eksportu. */
  tag: string;
  /** Tematy Argusa (slugi z knowledge/topics), ktore ten klaster zasila. */
  topicSlugs: string[];
  /** Rdzenie: dopasowanie od granicy slowa, otwarte z konca. */
  stems: string[];
  /** Cale slowa: obie granice. Dla krotkich, kolidujacych tokenow. */
  words?: string[];
}

export const CLUSTERS: TematCluster[] = [
  {
    tag: "podatki",
    topicSlugs: [
      "kwota-wolna",
      "kwota-wolna-12x",
      "pit-liniowy",
      "podatek-belki",
      "skladka-zdrowotna",
      "uproszczenia-przedsiebiorcy",
    ],
    stems: [
      "podatek",
      "podatk",
      "kwota wolna",
      "danin",
      "składk",
      "skladk",
      "belki",
      "fiskaln",
      "opodatkow",
      "system podatkow",
    ],
    words: ["pit"],
  },
  {
    tag: "finanse-panstwa",
    topicSlugs: ["konsolidacja-fiskalna"],
    stems: [
      "budżet",
      "budzet",
      "deficyt",
      "dług publiczn",
      "dlug publiczn",
      "finanse publiczn",
      "wydatki państwa",
      "wydatki panstwa",
      "konsolidacj",
    ],
  },
  {
    tag: "transfery-socjalne",
    topicSlugs: ["transfery-800plus"],
    stems: [
      "800 plus",
      "500 plus",
      "świadczenie wychowawcz",
      "swiadczenie wychowawcz",
      "transfer socjaln",
      "zasiłek",
      "zasilek",
      "becikow",
      "emerytur",
      "trzynast",
      "czternast",
      "socjaln",
      "polityka społeczn",
      "polityka spoleczn",
    ],
    words: ["800+", "500+"],
  },
  {
    tag: "energia-klimat",
    topicSlugs: ["klimat-energia"],
    stems: [
      "energet",
      "energi",
      "klimat",
      "jądrow",
      "jadrow",
      "węgiel",
      "wegiel",
      "odnawialn",
      "emisj",
      "zielony ład",
      "zielony lad",
      "elektrown",
      "smog",
      "atom",
      "ceny prąd",
      "ceny prad",
    ],
    words: ["oze", "ets"],
  },
  {
    tag: "obronnosc-ukraina",
    topicSlugs: ["obronnosc"],
    stems: [
      "wojsk",
      "obron",
      "zbroj",
      "armi",
      "ukrain",
      "wojn",
      "uchodźc",
      "uchodzc",
      "siły zbrojn",
      "sily zbrojn",
    ],
    words: ["nato"],
  },
  {
    tag: "euro-ue",
    topicSlugs: ["euro"],
    stems: [
      "euro",
      "wspólna walut",
      "wspolna walut",
      "strefa euro",
      "integracj europejsk",
    ],
    words: ["ue"],
  },
  {
    tag: "gospodarka-przedsiebiorcy",
    topicSlugs: ["uproszczenia-przedsiebiorcy", "dobrowolny-zus"],
    stems: [
      "przedsiębiorc",
      "przedsiebiorc",
      "samozatrudni",
      "działalność gospodarcz",
      "dzialalnosc gospodarcz",
      "inflacj",
      "koszty życia",
      "koszty zycia",
      "wynagrodz",
      "sytuacja materialn",
    ],
  },
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Kompilujemy raz. Granice liczymy na klasie liter/cyfr Unicode (\p{L}\p{N}),
// zeby polskie ogonki liczyly sie jako litera (inaczej "ę" udawalaby granice).
const compiled = CLUSTERS.map((c) => {
  const parts: string[] = [];
  for (const s of c.stems) parts.push(`(?<![\\p{L}\\p{N}])${escapeRe(s)}`);
  for (const w of c.words ?? []) parts.push(`(?<![\\p{L}\\p{N}])${escapeRe(w)}(?![\\p{L}\\p{N}])`);
  return { cluster: c, re: new RegExp(parts.join("|"), "iu") };
});

export interface Classification {
  tags: string[];
  topicSlugs: string[];
}

/** Zwraca tagi klastrow i slugi tematow dopasowane do tekstu (tytul + streszczenie). */
export function classify(title: string, summary: string): Classification {
  const hay = `${title} ${summary}`;
  const tags: string[] = [];
  const slugs = new Set<string>();
  for (const { cluster, re } of compiled) {
    if (re.test(hay)) {
      tags.push(cluster.tag);
      cluster.topicSlugs.forEach((s) => slugs.add(s));
    }
  }
  return { tags, topicSlugs: [...slugs] };
}
