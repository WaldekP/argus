import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatItemDate, isParaphrase, quoteText, sourceHost } from '@/lib/opponent-format';

test('data pozycji: pełna, sam miesiąc i brak daty', () => {
  assert.equal(formatItemDate('2026-03-14'), '14.03.2026');
  assert.equal(formatItemDate('2026-03'), '03.2026');
  assert.equal(formatItemDate(null), 'bez daty');
});

test('parafraza jest rozpoznawana i znacznik znika z wyświetlanego tekstu', () => {
  assert.equal(isParaphrase('[parafraza] Mówił, że podatki trzeba obniżyć'), true);
  assert.equal(isParaphrase('„Podatki trzeba obniżyć”'), false);
  assert.equal(quoteText('[Parafraza]  Mówił, że...'), 'Mówił, że...');
});

test('host źródła bez www, a niepoprawny adres zostaje jak jest', () => {
  assert.equal(sourceHost('https://www.rmf24.pl/fakty/polska/news-1'), 'rmf24.pl');
  assert.equal(sourceHost('nie-adres'), 'nie-adres');
});
