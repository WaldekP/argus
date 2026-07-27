/**
 * Budowa wiadomości otwierającej rozmowę z asystentem Argusa o zagadnieniu:
 * dossier własnej analizy (/topics/[id]) albo gotowe zagadnienie programowe
 * z bazy wiedzy (/temat/[slug]).
 *
 * Asystent nie ma dostępu do tabel zagadnień ani korpusów, więc wiadomość
 * niesie skrót treści: podsumowanie, kluczowe liczby, tezy linii ataku
 * i obrony. Całość jest twardo przycinana, bo jedzie też parametrem trasy.
 */

import type { Topic } from '@/lib/api/topics';
import type { Temat } from '@/lib/knowledge/types';

/** Twardy limit całej wiadomości: parametr URL i czytelny dymek usera. */
export const TOPIC_QUESTION_MAX_CHARS = 2600;

/** Limit podsumowania w skrócie dossier. */
const SUMMARY_MAX_CHARS = 1000;

/** Ile pozycji list (liczby, ataki, obrony) wchodzi do skrótu. */
const LIST_LIMIT = 5;

/** Pytanie doklejane na końcu, żeby asystent miał od czego zacząć. */
const OPENING_QUESTION =
  'Od czego zacząć komunikację tego zagadnienia i gdzie w rozmowie z dziennikarzem czekają największe ryzyka?';

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Wiadomość startowa nowej rozmowy: skrót dossier plus pytanie otwierające.
 * Sekcje bez treści są pomijane, więc działa też dla ubogiego dossier.
 */
export function buildTopicAssistantQuestion(topic: Topic): string {
  const parts: string[] = [`Porozmawiajmy o mojej analizie zagadnienia „${truncate(topic.title, 120)}".`];

  const summary = topic.dossier.summary.trim();
  if (summary.length > 0) {
    parts.push(`Podsumowanie analizy:\n${truncate(summary, SUMMARY_MAX_CHARS)}`);
  }

  const numbers = topic.dossier.key_numbers
    .filter((num) => num.label.trim().length > 0 && num.value.trim().length > 0)
    .slice(0, LIST_LIMIT)
    .map((num) => `- ${num.label.trim()}: ${num.value.trim()}`);
  if (numbers.length > 0) {
    parts.push(`Kluczowe liczby:\n${numbers.join('\n')}`);
  }

  const attack = topic.dossier.attack_defense.attack
    .map((line) => line.claim.trim())
    .filter((claim) => claim.length > 0)
    .slice(0, LIST_LIMIT)
    .map((claim) => `- ${claim}`);
  if (attack.length > 0) {
    parts.push(`Linie ataku:\n${attack.join('\n')}`);
  }

  const defense = topic.dossier.attack_defense.defense
    .map((line) => line.attack.trim())
    .filter((attackLine) => attackLine.length > 0)
    .slice(0, LIST_LIMIT)
    .map((attackLine) => `- ${attackLine}`);
  if (defense.length > 0) {
    parts.push(`Zarzuty, na które mam gotową obronę:\n${defense.join('\n')}`);
  }

  const digest = truncate(parts.join('\n\n'), TOPIC_QUESTION_MAX_CHARS - OPENING_QUESTION.length - 2);
  return `${digest}\n\n${OPENING_QUESTION}`;
}

/**
 * Wiadomość startowa rozmowy o gotowym zagadnieniu programowym z bazy wiedzy:
 * rekomendacja, kluczowe liczby (tylko te do publikacji), warstwy „podchwycić"
 * i „uderzyć". Liczby niezweryfikowane świadomie zostają poza skrótem.
 */
export function buildKnowledgeTopicAssistantQuestion(temat: Temat): string {
  const parts: string[] = [
    `Porozmawiajmy o zagadnieniu „${truncate(temat.nazwa, 120)}" z mojej bazy wiedzy.`,
  ];

  const { rekomendacja } = temat;
  if (rekomendacja.odpowiedz.trim().length > 0) {
    parts.push(
      `Rekomendacja (${truncate(rekomendacja.pytanie, 200)}):\n${truncate(rekomendacja.odpowiedz, 400)}`
    );
  }

  const numbers = temat.kluczoweLiczby
    .filter((liczba) => liczba.doPublikacji && liczba.wartosc.trim().length > 0)
    .slice(0, LIST_LIMIT)
    .map((liczba) => `- ${liczba.wartosc.trim()}: ${truncate(liczba.opis, 160)}`);
  if (numbers.length > 0) {
    parts.push(`Kluczowe liczby:\n${numbers.join('\n')}`);
  }

  const podchwycic = (rekomendacja.podchwycic ?? [])
    .filter((punkt) => punkt.trim().length > 0)
    .slice(0, LIST_LIMIT)
    .map((punkt) => `- ${truncate(punkt, 200)}`);
  if (podchwycic.length > 0) {
    parts.push(`Co podchwycić:\n${podchwycic.join('\n')}`);
  }

  const zaatakowac = (rekomendacja.zaatakowac ?? [])
    .filter((punkt) => punkt.trim().length > 0)
    .slice(0, LIST_LIMIT)
    .map((punkt) => `- ${truncate(punkt, 200)}`);
  if (zaatakowac.length > 0) {
    parts.push(`Gdzie uderzyć:\n${zaatakowac.join('\n')}`);
  }

  const digest = truncate(parts.join('\n\n'), TOPIC_QUESTION_MAX_CHARS - OPENING_QUESTION.length - 2);
  return `${digest}\n\n${OPENING_QUESTION}`;
}
