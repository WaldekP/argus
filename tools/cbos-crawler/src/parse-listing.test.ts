import assert from "node:assert/strict";
import { test } from "node:test";
import { parseListing } from "./parse-listing.ts";

// Fragment listingu w strukturze cbos.pl (anchor owija h2/h3/p, aria-label
// niesie autora i date). Dwa wpisy: komunikat + inny typ (do pominiecia).
const HTML = `
<a href='../publikacje/raporty_tekst.php?id=7244' class='home'
   aria-label='Komunikat z badań nr 79/2026: Wokół sporu - streszczenie - Autor: Beata Roguska - data publikacji: 2026-07-23.'>
  <h2 id='7244'>Komunikat z badań nr 79/2026</h2>
  <h3 class='home_tytul_txt_all'>Wokół polsko-ukraińskiego sporu</h3>
  <p class='home_tekst_txt'><img src='x.jpg'>Pogląd, że 44% osób popiera, a 42% nie.</p>
</a>
<a href='../publikacje/raporty_tekst.php?id=7000' class='home'
   aria-label='Opinie i Diagnozy nr 50: Coś tam'>
  <h2 id='7000'>Opinie i Diagnozy nr 50</h2>
  <h3 class='home_tytul_txt_all'>Inny typ publikacji</h3>
  <p class='home_tekst_txt'>Treść.</p>
</a>`;

test("parseListing: wyciaga tylko komunikaty z badań", () => {
  const rows = parseListing(HTML);
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.id, 7244);
  assert.equal(r.num, 79);
  assert.equal(r.year, 2026);
  assert.equal(r.numer, "79/2026");
  assert.equal(r.title, "Wokół polsko-ukraińskiego sporu");
  assert.equal(r.pubDate, "2026-07-23");
  assert.equal(r.author, "Beata Roguska");
  assert.match(r.summary, /44% osób popiera/);
});

test("parseListing: pomija inne typy publikacji (brak numeru/roku)", () => {
  const rows = parseListing(HTML);
  assert.equal(rows.some((r) => r.id === 7000), false);
});

test("parseListing: pusty wejsciowy HTML daje pusta liste", () => {
  assert.deepEqual(parseListing("<div>nic</div>"), []);
});
