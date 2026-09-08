/**
 * Minimalny parser Markdownu pod odpowiedzi asystenta.
 *
 * Model formatuje odpowiedzi Markdownem (pogrubienia tez, wypunktowania),
 * a `ThemedText` renderuje czysty tekst, więc do tej pory użytkownik oglądał
 * na ekranie dosłowne gwiazdki: „**Teza 1: ...**”. Zamiast wciągać bibliotekę
 * markdownową (na React Native ciągną za sobą własny system stylów) tłumaczymy
 * tu tylko to, czego model faktycznie używa: akapity, wypunktowania i
 * pogrubienia w linii.
 *
 * Świadomie NIE obsługujemy: linków, obrazków, tabel, kodu i cytatów. Gdyby
 * model zaczął ich używać, zostaną tekstem, a nie zepsują układu.
 */

/** Fragment linii: kawałek tekstu z informacją, czy jest pogrubiony. */
export type MarkdownSpan = {
  text: string;
  bold: boolean;
};

/** Blok dokumentu. `marker` niesie kropkę albo numer pozycji listy. */
export type MarkdownBlock =
  | { type: 'paragraph'; spans: MarkdownSpan[] }
  | { type: 'listItem'; marker: string; spans: MarkdownSpan[] };

/** Nagłówek Markdownu traktujemy jak akapit w całości pogrubiony. */
const HEADING = /^#{1,6}\s+(.*)$/;
const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*(\d{1,2})[.)]\s+(.*)$/;

/**
 * Dzieli linię na fragmenty po `**pogrubienie**`. Nieparzysta liczba par
 * gwiazdek (model urwał się w połowie strumienia) zostaje tekstem, bo lepiej
 * pokazać gwiazdkę niż zgubić treść.
 */
export function parseSpans(line: string, forceBold = false): MarkdownSpan[] {
  const spans: MarkdownSpan[] = [];
  const pattern = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > last) {
      spans.push({ text: line.slice(last, match.index), bold: forceBold });
    }
    spans.push({ text: match[1], bold: true });
    last = match.index + match[0].length;
  }
  if (last < line.length) {
    spans.push({ text: line.slice(last), bold: forceBold });
  }
  return spans.length > 0 ? spans : [{ text: line, bold: forceBold }];
}

/** Zamienia tekst modelu na listę bloków gotowych do renderowania. */
export function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: 'paragraph', spans: parseSpans(paragraph.join(' ')) });
    paragraph = [];
  };

  for (const rawLine of source.split('\n')) {
    const line = rawLine.trimEnd();

    if (line.trim().length === 0) {
      flush();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: 'paragraph', spans: parseSpans(heading[1], true) });
      continue;
    }

    const numbered = NUMBERED.exec(line);
    if (numbered) {
      flush();
      blocks.push({ type: 'listItem', marker: `${numbered[1]}.`, spans: parseSpans(numbered[2]) });
      continue;
    }

    const bullet = BULLET.exec(line);
    if (bullet) {
      flush();
      blocks.push({ type: 'listItem', marker: '•', spans: parseSpans(bullet[1]) });
      continue;
    }

    paragraph.push(line.trim());
  }

  flush();
  return blocks;
}
