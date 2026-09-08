/**
 * Renderuje odpowiedź asystenta z lekkim Markdownem: akapity, wypunktowania
 * i pogrubienia w linii. Parser siedzi w `@/lib/markdown`, tutaj zostaje sam
 * układ.
 *
 * Powód istnienia: model formatuje odpowiedzi Markdownem, a zwykły `ThemedText`
 * pokazywał składnię dosłownie, więc tezy wyglądały tak: „**Teza 1: ...**”.
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontFamily, Spacing, type ThemeColor } from '@/constants/theme';
import { parseMarkdown, type MarkdownSpan } from '@/lib/markdown';

type Props = {
  content: string;
  themeColor?: ThemeColor;
};

function renderSpans(spans: MarkdownSpan[]) {
  return spans.map((span, index) => (
    <ThemedText key={index} style={span.bold ? styles.bold : undefined}>
      {span.text}
    </ThemedText>
  ));
}

export function MarkdownText({ content, themeColor = 'text' }: Props) {
  const blocks = parseMarkdown(content);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {blocks.map((block, index) =>
        block.type === 'listItem' ? (
          <View key={index} style={styles.listRow}>
            <ThemedText themeColor={themeColor} style={styles.marker}>
              {block.marker}
            </ThemedText>
            <ThemedText themeColor={themeColor} style={styles.listText}>
              {renderSpans(block.spans)}
            </ThemedText>
          </View>
        ) : (
          <ThemedText key={index} themeColor={themeColor}>
            {renderSpans(block.spans)}
          </ThemedText>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  bold: {
    fontFamily: FontFamily.sansSemiBold,
  },
  listRow: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  marker: {
    minWidth: Spacing.three,
  },
  listText: {
    flex: 1,
  },
});
