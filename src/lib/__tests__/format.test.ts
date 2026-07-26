/**
 * Testy helperów formatowania tekstów UI.
 *
 * Sens tych testów: teksty jadą wprost na ekran, a reguły polskiej odmiany
 * i zapis „brak danych" to konwencje produktowe z CLAUDE.md, nie detal
 * implementacji. Do tego zapis liczb musi wyglądać identycznie na webie,
 * iOS i Androidzie, a tam różni się dostępność ICU.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatDate,
  formatDateNumeric,
  formatMoney,
  formatYear,
  polishPlural,
  yearsLabel,
  yearsSince,
} from '@/lib/format';

/** Spacja nierozdzielająca (U+00A0): separator tysięcy w polskim zapisie. */
const NBSP = ' ';

describe('formatDate', () => {
  test('zapis słowny z miesiącem w dopełniaczu', () => {
    assert.equal(formatDate('2026-07-23'), '23 lipca 2026');
    assert.equal(formatDate('2026-01-01'), '1 stycznia 2026');
    assert.equal(formatDate('2026-12-31'), '31 grudnia 2026');
  });

  test('nieparsowalna data to pusty tekst, nie „Invalid Date"', () => {
    assert.equal(formatDate('nie-data'), '');
    assert.equal(formatDate(''), '');
  });
});

describe('formatDateNumeric', () => {
  test('zapis DD.MM.RRRR', () => {
    assert.equal(formatDateNumeric('2026-07-23'), '23.07.2026');
  });

  test('obcina znacznik czasu do samej daty', () => {
    assert.equal(formatDateNumeric('2026-07-23T18:30:00Z'), '23.07.2026');
  });

  test('brak wartości to „brak danych", nigdy pustka', () => {
    assert.equal(formatDateNumeric(null), 'brak danych');
    assert.equal(formatDateNumeric(undefined), 'brak danych');
    assert.equal(formatDateNumeric(''), 'brak danych');
    assert.equal(formatDateNumeric('2026'), 'brak danych');
  });
});

describe('formatYear', () => {
  test('sam rok', () => {
    assert.equal(formatYear('2026-07-23'), '2026');
  });

  test('brak wartości to „brak danych"', () => {
    assert.equal(formatYear(null), 'brak danych');
    assert.equal(formatYear(undefined), 'brak danych');
  });
});

describe('polishPlural', () => {
  test('liczba pojedyncza', () => {
    assert.equal(polishPlural(1, 'wariant', 'warianty', 'wariantów'), '1 wariant');
  });

  test('forma mnoga dla 2-4', () => {
    assert.equal(polishPlural(2, 'wariant', 'warianty', 'wariantów'), '2 warianty');
    assert.equal(polishPlural(4, 'wariant', 'warianty', 'wariantów'), '4 warianty');
  });

  test('forma dopełniaczowa dla 5-21', () => {
    assert.equal(polishPlural(5, 'wariant', 'warianty', 'wariantów'), '5 wariantów');
    assert.equal(polishPlural(21, 'wariant', 'warianty', 'wariantów'), '21 wariantów');
  });

  test('wyjątek 12-14 bierze formę dopełniaczową, nie 2-4', () => {
    assert.equal(polishPlural(12, 'wariant', 'warianty', 'wariantów'), '12 wariantów');
    assert.equal(polishPlural(13, 'wariant', 'warianty', 'wariantów'), '13 wariantów');
    assert.equal(polishPlural(14, 'wariant', 'warianty', 'wariantów'), '14 wariantów');
  });

  test('setki nie psują reguły dziesiątek', () => {
    assert.equal(polishPlural(22, 'wariant', 'warianty', 'wariantów'), '22 warianty');
    assert.equal(polishPlural(112, 'wariant', 'warianty', 'wariantów'), '112 wariantów');
    assert.equal(polishPlural(102, 'wariant', 'warianty', 'wariantów'), '102 warianty');
  });

  test('zero bierze formę dopełniaczową', () => {
    assert.equal(polishPlural(0, 'wariant', 'warianty', 'wariantów'), '0 wariantów');
  });
});

describe('formatMoney', () => {
  test('separator tysięcy to spacja nierozdzielająca, nie przecinek', () => {
    // Kluczowy test przenośności: na Hermesie (iOS, Android) brakuje pełnego
    // ICU, więc oparcie się o toLocaleString dawało tam zapis angielski.
    assert.equal(formatMoney(46_580), `46${NBSP}580 PLN`);
    assert.equal(formatMoney(1000), `1${NBSP}000 PLN`);
    assert.ok(!formatMoney(46_580).includes(','), 'brak przecinka jako separatora tysięcy');
  });

  test('liczby poniżej tysiąca bez separatora', () => {
    assert.equal(formatMoney(500), '500 PLN');
    assert.equal(formatMoney(0), '0 PLN');
  });

  test('miliony skracane do jednego miejsca po przecinku', () => {
    assert.equal(formatMoney(46_580_831), '46,6 mln PLN');
    assert.equal(formatMoney(1_000_000), '1,0 mln PLN');
  });

  test('powyżej 100 mln bez części dziesiętnej', () => {
    assert.equal(formatMoney(123_400_000), '123 mln PLN');
  });

  test('waluta inna niż PLN', () => {
    assert.equal(formatMoney(2000, 'EUR'), `2${NBSP}000 EUR`);
    assert.equal(formatMoney(2000, null), `2${NBSP}000 PLN`);
  });

  test('kwoty ujemne zachowują znak', () => {
    assert.equal(formatMoney(-1500), `-1${NBSP}500 PLN`);
    assert.equal(formatMoney(-2_500_000), '-2,5 mln PLN');
  });

  test('brak kwoty to „brak danych", nie zero', () => {
    assert.equal(formatMoney(null), 'brak danych');
    assert.equal(formatMoney(undefined), 'brak danych');
    assert.equal(formatMoney(Number.NaN), 'brak danych');
    assert.equal(formatMoney(Number.POSITIVE_INFINITY), 'brak danych');
  });
});

describe('yearsSince', () => {
  test('brak albo niepoprawna data to null', () => {
    assert.equal(yearsSince(null), null);
    assert.equal(yearsSince(undefined), null);
    assert.equal(yearsSince('nie-data'), null);
  });

  test('data z przyszłości to null, nie liczba ujemna', () => {
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(yearsSince(future), null);
  });

  test('liczy pełne lata wstecz', () => {
    const threeYearsAgo = new Date(Date.now() - 3.5 * 365.25 * 24 * 60 * 60 * 1000);
    assert.equal(yearsSince(threeYearsAgo.toISOString()), 3);
  });
});

describe('yearsLabel', () => {
  test('zero lat opisujemy słownie, bo „0 lat" wygląda jak błąd', () => {
    assert.equal(yearsLabel(0), 'poniżej roku');
  });

  test('odmiana stażu', () => {
    assert.equal(yearsLabel(1), '1 rok');
    assert.equal(yearsLabel(3), '3 lata');
    assert.equal(yearsLabel(5), '5 lat');
    assert.equal(yearsLabel(13), '13 lat');
  });
});
