/**
 * Propozycje pytań do asystenta Argusa na dany dzień, budowane z briefu dnia
 * (karta „Zapytaj Argusa" na Pulpicie). Bez wywołania AI: szablony sklejane
 * z nagłówkami wydarzeń działają natychmiast i nic nie kosztują, a jakość
 * pytań rośnie razem z jakością nagłówków briefu.
 *
 * Projekt: docs/superpowers/specs/2026-07-27-asystent-argus-design.md
 */

import type { DailyBrief } from '@/lib/api/daily-brief';

/** Maksymalna liczba propozycji na karcie. */
export const SUGGESTIONS_LIMIT = 3;

/** Nagłówki dłuższe niż to ucinamy, żeby pytanie mieściło się na chipie. */
const HEADLINE_MAX_LENGTH = 90;

/** Szablony pytań, po jednym na kolejne wydarzenie z briefu. */
const TEMPLATES: ((headline: string) => string)[] = [
  (headline) => `Jak skomentować: „${headline}”?`,
  (headline) => `Co dla mnie oznacza: „${headline}”?`,
  (headline) => `Jak przygotować się na pytania o: „${headline}”?`,
];

/** Zestaw ogólny, gdy briefu dnia jeszcze nie ma albo nie dało się go pobrać. */
export const FALLBACK_SUGGESTIONS = [
  'Co powinno być dziś moim głównym przekazem?',
  'Na jakie pytania od dziennikarzy mam się dziś przygotować?',
  'Na czym się dziś skupić w komunikacji?',
];

function truncateHeadline(headline: string): string {
  if (headline.length <= HEADLINE_MAX_LENGTH) {
    return headline;
  }
  return `${headline.slice(0, HEADLINE_MAX_LENGTH).trimEnd()}…`;
}

/**
 * Propozycje pytań z briefu dnia. Brief niegotowy, pusty albo `null` daje
 * zestaw ogólny, więc karta zawsze ma co pokazać.
 */
export function buildAssistantSuggestions(brief: DailyBrief | null): string[] {
  if (!brief || brief.status !== 'ready') {
    return FALLBACK_SUGGESTIONS;
  }

  const headlines = brief.items
    .map((item) => item.naglowek.trim())
    .filter((headline) => headline.length > 0)
    .slice(0, SUGGESTIONS_LIMIT);

  if (headlines.length === 0) {
    return FALLBACK_SUGGESTIONS;
  }

  return headlines.map((headline, index) =>
    TEMPLATES[index % TEMPLATES.length](truncateHeadline(headline))
  );
}
