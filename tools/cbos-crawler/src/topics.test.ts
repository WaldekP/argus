import assert from "node:assert/strict";
import { test } from "node:test";
import { classify } from "./topics.ts";
import { pdfUrlFor } from "./parse-listing.ts";

test("classify: temat wprost z tytulu", () => {
  assert.ok(
    classify("Polacy o ograniczeniu pomocy dla uchodźców z Ukrainy", "").tags.includes(
      "obronnosc-ukraina",
    ),
  );
  assert.ok(classify("Polacy o przyjęciu euro", "").tags.includes("euro-ue"));
  assert.ok(classify("Opinie o kwocie wolnej od podatku", "").tags.includes("podatki"));
});

test("classify: granica slowa chroni przed falszywym trafieniem w srodku slowa", () => {
  // "atom"/"nato" siedza w "Natomiast" — nie wolno ich zlapac.
  const c = classify("Nastroje na rynku pracy", "Natomiast wszystko inne bez zmian.");
  assert.equal(c.tags.includes("energia-klimat"), false);
  assert.equal(c.tags.includes("obronnosc-ukraina"), false);
});

test("classify: cale slowa (NATO/OZE/PIT/UE) tylko jako osobne slowo", () => {
  assert.ok(classify("Stosunek Polaków do NATO", "").tags.includes("obronnosc-ukraina"));
  assert.ok(classify("Poparcie dla PIT liniowego", "").tags.includes("podatki"));
  // "ue" w srodku slowa nie liczy sie jako UE.
  assert.equal(classify("Nastroje społeczne", "Kolejne miesiące.").tags.length, 0);
});

test("classify: brak tematu = brak tagow", () => {
  assert.deepEqual(classify("Zaufanie do polityków w lipcu", "Notowania osób publicznych.").tags, []);
});

test("classify: slugi tematow z klastra", () => {
  const c = classify("Składka zdrowotna przedsiębiorców", "");
  assert.ok(c.topicSlugs.includes("skladka-zdrowotna"));
});

test("pdfUrlFor: zero-padding numeru i dwucyfrowy rok", () => {
  assert.equal(
    pdfUrlFor("https://www.cbos.pl", "/SPISKOM.POL", 79, 2026),
    "https://www.cbos.pl/SPISKOM.POL/2026/K_079_26.PDF",
  );
  assert.equal(
    pdfUrlFor("https://www.cbos.pl", "/SPISKOM.POL", 5, 2016),
    "https://www.cbos.pl/SPISKOM.POL/2016/K_005_16.PDF",
  );
});
