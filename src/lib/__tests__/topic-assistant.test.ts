/**
 * Testy wiadomości otwierającej rozmowę z asystentem o analizie zagadnienia.
 *
 * Sens: wiadomość jedzie parametrem trasy do /asystent-argus i wprost do
 * promptu asystenta, więc twardy limit długości i kompletność skrótu dossier
 * to kontrakt produktowy, nie detal implementacji.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import type { Topic } from '@/lib/api/topics';
import type { Temat } from '@/lib/knowledge/types';
import {
  buildKnowledgeTopicAssistantQuestion,
  buildTopicAssistantQuestion,
  TOPIC_QUESTION_MAX_CHARS,
} from '@/lib/topic-assistant';

function makeTopic(overrides: Partial<Topic['dossier']> = {}, title = 'Kwota wolna 60 tys.'): Topic {
  return {
    id: 'topic-1',
    title,
    status: 'ready',
    created_at: '2026-07-27T08:00:00Z',
    source_chars: 1000,
    documents: [],
    dossier: {
      summary: 'Analiza kosztów kwoty wolnej.',
      key_numbers: [],
      questions: [],
      attack_defense: { attack: [], defense: [] },
      ...overrides,
    },
  };
}

function makeTemat(overrides: Partial<Temat> = {}): Temat {
  return {
    slug: 'kwota-wolna',
    nazwa: 'Kwota wolna od podatku',
    zajawka: 'Obietnica 60 tys. zł.',
    aktualizacja: '24 lipca 2026',
    korpus: 'docs/kwota-wolna',
    liczbaZrodel: 134,
    doWeryfikacji: 2,
    rekomendacja: {
      pytanie: 'Czy podnosić kwotę wolną?',
      odpowiedz: 'Tak, z jasnym finansowaniem.',
      uzasadnienie: [],
      ryzyko: [],
      podchwycic: ['Indeksacja do płacy minimalnej'],
      zaatakowac: ['Brak źródła finansowania u konkurencji'],
    },
    kluczoweLiczby: [
      { wartosc: '79 proc.', opis: 'poparcie bez kosztu w pytaniu', doPublikacji: true },
      { wartosc: '52 mld zł', opis: 'liczba niezweryfikowana', doPublikacji: false },
    ],
    syntezaOpinii: [],
    politycy: [],
    segmenty: [],
    luki: [],
    ...overrides,
  };
}

describe('buildKnowledgeTopicAssistantQuestion', () => {
  test('zawiera nazwę, rekomendację, warstwy taktyczne i pytanie otwierające', () => {
    const question = buildKnowledgeTopicAssistantQuestion(makeTemat());
    assert.ok(question.includes('Kwota wolna od podatku'));
    assert.ok(question.includes('Tak, z jasnym finansowaniem.'));
    assert.ok(question.includes('Indeksacja do płacy minimalnej'));
    assert.ok(question.includes('Brak źródła finansowania u konkurencji'));
    assert.ok(question.trimEnd().endsWith('?'));
  });

  test('liczby nie do publikacji zostają poza skrótem', () => {
    const question = buildKnowledgeTopicAssistantQuestion(makeTemat());
    assert.ok(question.includes('79 proc.'));
    assert.ok(!question.includes('52 mld zł'));
  });

  test('całość mieści się w twardym limicie', () => {
    const question = buildKnowledgeTopicAssistantQuestion(
      makeTemat({
        rekomendacja: {
          pytanie: 'p'.repeat(400),
          odpowiedz: 'o'.repeat(2000),
          uzasadnienie: [],
          ryzyko: [],
          podchwycic: Array.from({ length: 10 }, (_, i) => `punkt ${i} ${'x'.repeat(300)}`),
          zaatakowac: [],
        },
      })
    );
    assert.ok(question.length <= TOPIC_QUESTION_MAX_CHARS);
    assert.ok(question.trimEnd().endsWith('?'));
  });
});

describe('buildTopicAssistantQuestion', () => {
  test('zawiera tytuł, podsumowanie i pytanie otwierające', () => {
    const question = buildTopicAssistantQuestion(makeTopic());
    assert.ok(question.includes('Kwota wolna 60 tys.'));
    assert.ok(question.includes('Analiza kosztów kwoty wolnej.'));
    assert.ok(question.trimEnd().endsWith('?'));
  });

  test('kluczowe liczby i linie wchodzą do skrótu, puste sekcje są pomijane', () => {
    const question = buildTopicAssistantQuestion(
      makeTopic({
        key_numbers: [
          { label: 'Koszt reformy', value: '52 mld zł', status: 'zweryfikowane', context: '' },
          { label: '', value: '10', status: 'do weryfikacji', context: '' },
        ],
        attack_defense: {
          attack: [
            { target: 'PiS', claim: 'Obiecali i nie zrobili', evidence: '', message: '', caution: '' },
          ],
          defense: [{ attack: 'Skąd pieniądze?', response: '', bridge: '' }],
        },
      })
    );
    assert.ok(question.includes('Koszt reformy: 52 mld zł'));
    assert.ok(question.includes('Obiecali i nie zrobili'));
    assert.ok(question.includes('Skąd pieniądze?'));
    // Pozycja bez etykiety nie generuje pustego wiersza listy.
    assert.ok(!question.includes('- : 10'));
  });

  test('dossier bez treści nadal daje sensowną wiadomość z pytaniem', () => {
    const question = buildTopicAssistantQuestion(makeTopic({ summary: '' }));
    assert.ok(question.includes('Porozmawiajmy o mojej analizie'));
    assert.ok(question.trimEnd().endsWith('?'));
  });

  test('bardzo długie dossier jest przycinane do twardego limitu', () => {
    const question = buildTopicAssistantQuestion(
      makeTopic({ summary: 'x'.repeat(5000) }, 'T'.repeat(300))
    );
    assert.ok(question.length <= TOPIC_QUESTION_MAX_CHARS);
    assert.ok(question.includes('…'));
    // Pytanie otwierające przeżywa przycinanie w całości.
    assert.ok(question.trimEnd().endsWith('?'));
  });
});
