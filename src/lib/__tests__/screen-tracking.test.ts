/**
 * Testy normalizacji ścieżek ekranów.
 *
 * Sens: to jedyna bariera między adresem w aplikacji a tym, co trafia do
 * PostHoga. Regresja tutaj nie wywala aplikacji, tylko po cichu wynosi na
 * zewnątrz identyfikatory briefów i analiz oraz rozbija statystyki na setki
 * jednorazowych ścieżek, z których nic nie da się policzyć.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { normalizePath } from '@/lib/screen-path';

describe('normalizePath', () => {
  test('identyfikator briefu zamienia się na :id', () => {
    assert.equal(
      normalizePath('/brief/f8182c0a-3cf3-4977-91df-a4f00de38b39'),
      '/brief/:id'
    );
  });

  test('identyfikator analizy też, niezależnie od wielkości liter', () => {
    assert.equal(
      normalizePath('/analysis/D5E96D07-3E34-4A22-AB1C-988154898708'),
      '/analysis/:id'
    );
  });

  test('data w adresie archiwum staje się :date', () => {
    assert.equal(normalizePath('/brief-poranny/2026-09-11'), '/brief-poranny/:date');
  });

  test('zwykłe ścieżki zostają bez zmian', () => {
    assert.equal(normalizePath('/brief-poranny/hasla'), '/brief-poranny/hasla');
    assert.equal(normalizePath('/dziennikarze'), '/dziennikarze');
  });

  test('korzeń aplikacji zostaje korzeniem', () => {
    assert.equal(normalizePath('/'), '/');
  });

  test('końcowy ukośnik znika, żeby nie liczyć dwóch ekranów zamiast jednego', () => {
    assert.equal(normalizePath('/analizy/'), '/analizy');
  });

  test('slug tematu nie jest identyfikatorem i ma zostać czytelny', () => {
    assert.equal(normalizePath('/temat/kwota-wolna'), '/temat/kwota-wolna');
  });
});
