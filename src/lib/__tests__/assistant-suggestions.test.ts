/**
 * Testy propozycji pytań do asystenta Argusa.
 *
 * Sens: propozycje jadą wprost na Pulpit i do promptu asystenta, a zasada
 * degradacji (brak briefu = zestaw ogólny, nigdy pusta karta) to kontrakt
 * produktowy, nie detal implementacji.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import type { DailyBrief, DailyBriefItem } from '@/lib/api/daily-brief';
import {
  buildAssistantSuggestions,
  FALLBACK_SUGGESTIONS,
  SUGGESTIONS_LIMIT,
} from '@/lib/assistant-suggestions';

function makeItem(naglowek: string): DailyBriefItem {
  return {
    kategoria: 'polityka',
    naglowek,
    streszczenie: 'streszczenie',
    znaczenie_dla_ciebie: 'znaczenie',
    zrodla: [],
    source_type: 'press',
  };
}

function makeBrief(items: DailyBriefItem[], status: DailyBrief['status'] = 'ready'): DailyBrief {
  return {
    brief_date: '2026-07-27',
    status,
    lead: 'lead',
    items,
    model: null,
    generated_at: null,
    error: null,
  };
}

describe('buildAssistantSuggestions', () => {
  test('brak briefu daje zestaw ogólny', () => {
    assert.deepEqual(buildAssistantSuggestions(null), FALLBACK_SUGGESTIONS);
  });

  test('brief w trakcie generowania albo z błędem daje zestaw ogólny', () => {
    assert.deepEqual(
      buildAssistantSuggestions(makeBrief([makeItem('Nagłówek')], 'generating')),
      FALLBACK_SUGGESTIONS
    );
    assert.deepEqual(
      buildAssistantSuggestions(makeBrief([makeItem('Nagłówek')], 'error')),
      FALLBACK_SUGGESTIONS
    );
  });

  test('brief gotowy, ale bez wydarzeń, daje zestaw ogólny', () => {
    assert.deepEqual(buildAssistantSuggestions(makeBrief([])), FALLBACK_SUGGESTIONS);
    assert.deepEqual(buildAssistantSuggestions(makeBrief([makeItem('   ')])), FALLBACK_SUGGESTIONS);
  });

  test('pytania zawierają nagłówki wydarzeń i różnią się szablonem', () => {
    const suggestions = buildAssistantSuggestions(
      makeBrief([makeItem('Sejm o budżecie'), makeItem('Spór o kwotę wolną')])
    );
    assert.equal(suggestions.length, 2);
    assert.ok(suggestions[0].includes('Sejm o budżecie'));
    assert.ok(suggestions[1].includes('Spór o kwotę wolną'));
    assert.notEqual(suggestions[0].replace('Sejm o budżecie', ''), suggestions[1].replace('Spór o kwotę wolną', ''));
  });

  test('liczba propozycji nie przekracza limitu', () => {
    const items = ['A', 'B', 'C', 'D', 'E'].map((n) => makeItem(`Wydarzenie ${n}`));
    assert.equal(buildAssistantSuggestions(makeBrief(items)).length, SUGGESTIONS_LIMIT);
  });

  test('bardzo długi nagłówek jest ucinany z wielokropkiem', () => {
    const long = 'x'.repeat(200);
    const [suggestion] = buildAssistantSuggestions(makeBrief([makeItem(long)]));
    assert.ok(suggestion.includes('…'));
    assert.ok(suggestion.length < long.length);
  });
});
