/**
 * Testy parsera Markdownu z odpowiedzi asystenta.
 *
 * Sens: to jedyna warstwa między tym, co wypluwa model, a tym, co widzi
 * użytkownik. Regresja tutaj nie wywala aplikacji, tylko po cichu wraca do
 * ściany tekstu z gwiazdkami, czyli do stanu sprzed poprawki.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { parseMarkdown, parseSpans } from '@/lib/markdown';

describe('parseSpans', () => {
  test('wyciąga pogrubienie ze środka zdania', () => {
    assert.deepEqual(parseSpans('to jest **ważne** zdanie'), [
      { text: 'to jest ', bold: false },
      { text: 'ważne', bold: true },
      { text: ' zdanie', bold: false },
    ]);
  });

  test('urwane pogrubienie zostaje tekstem, bo lepsza gwiazdka niż zgubiona treść', () => {
    assert.deepEqual(parseSpans('**Teza 1: kwota woln'), [
      { text: '**Teza 1: kwota woln', bold: false },
    ]);
  });

  test('linia bez znaczników to jeden zwykły fragment', () => {
    assert.deepEqual(parseSpans('zwykły tekst'), [{ text: 'zwykły tekst', bold: false }]);
  });
});

describe('parseMarkdown', () => {
  test('akapity rozdziela pusta linia, a nie każde zawinięcie', () => {
    const blocks = parseMarkdown('pierwsza linia\ndruga linia\n\ndrugi akapit');
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].spans[0].text, 'pierwsza linia druga linia');
    assert.equal(blocks[1].spans[0].text, 'drugi akapit');
  });

  test('rozpoznaje wypunktowania i listy numerowane', () => {
    const blocks = parseMarkdown('- pierwszy\n- drugi\n\n1. krok\n2) drugi krok');
    assert.deepEqual(
      blocks.map((b) => (b.type === 'listItem' ? b.marker : 'akapit')),
      ['•', '•', '1.', '2.']
    );
  });

  test('nagłówek staje się pogrubionym akapitem', () => {
    const [block] = parseMarkdown('## Rekomendacja');
    assert.equal(block.type, 'paragraph');
    assert.deepEqual(block.spans, [{ text: 'Rekomendacja', bold: true }]);
  });

  test('typowa odpowiedź asystenta nie gubi treści tez', () => {
    const blocks = parseMarkdown(
      'Oto trzy tezy.\n\n**Teza 1: kwota wolna to zwrot.** Rozwinięcie tezy.\n\n- argument pierwszy'
    );
    assert.equal(blocks.length, 3);
    assert.equal(blocks[1].spans[0].bold, true);
    assert.equal(blocks[1].spans[0].text, 'Teza 1: kwota wolna to zwrot.');
    assert.equal(blocks[2].type, 'listItem');
  });

  test('pusty tekst nie tworzy pustego bloku', () => {
    assert.deepEqual(parseMarkdown('   \n\n  '), []);
  });
});
