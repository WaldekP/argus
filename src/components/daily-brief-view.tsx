import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { EyeDot } from '@/components/eye-dot';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { track } from '@/lib/analytics/posthog';
import type { DailyBrief, DailyBriefItem } from '@/lib/api/daily-brief';
import { openExternalUrl } from '@/lib/open-url';

/**
 * Widok przeglądu dnia: karty wydarzeń dobranych i skomentowanych pod strategię
 * polityka. Wspólny dla ekranu Brief poranny (dziś) i archiwum w zakładce Briefy.
 *
 * Świadomie bez wykresów i liczników — to nie dashboard, tylko przegląd tego,
 * na co ktoś dziś zapyta, z warstwą "co to znaczy dla Ciebie".
 */
export function DailyBriefView({ brief }: { brief: DailyBrief }) {
  const theme = useTheme();

  if (brief.items.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="eye-outline" size={36} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
          {brief.lead ?? 'Dziś w monitorowanych źródłach cicho. Brak materiału na przegląd.'}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {brief.lead ? (
        <ThemedText style={styles.lead} themeColor="textSecondary">
          {brief.lead}
        </ThemedText>
      ) : null}

      {brief.items.map((item, index) => (
        <BriefCard key={`${item.naglowek}-${index}`} item={item} />
      ))}
    </View>
  );
}

function BriefCard({ item }: { item: DailyBriefItem }) {
  const theme = useTheme();

  const handleSource = async (url: string, redakcja: string | null) => {
    if (!url) return;
    track('daily_brief_item_source_opened', { redakcja: redakcja ?? 'nieznana' });
    await openExternalUrl(url);
  };

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
      <View style={[styles.chip, { borderColor: theme.accent }]}>
        <ThemedText type="small" themeColor="accentLight" style={styles.chipText}>
          {item.kategoria}
        </ThemedText>
      </View>

      <ThemedText style={styles.headline}>{item.naglowek}</ThemedText>
      <ThemedText themeColor="textSecondary">{item.streszczenie}</ThemedText>

      <View style={[styles.significance, { borderLeftColor: theme.teal }]}>
        <ThemedText type="small" themeColor="teal" style={styles.significanceLabel}>
          Co to znaczy dla Ciebie
        </ThemedText>
        <ThemedText type="small">{item.znaczenie_dla_ciebie}</ThemedText>
      </View>

      {item.zrodla.length > 0 ? (
        <View style={styles.sources}>
          {item.zrodla.map((source, i) => {
            const clickable = Boolean(source.url);
            return (
              <ThemedText
                key={`${source.url}-${i}`}
                type="small"
                themeColor={clickable ? 'accentLight' : 'textSecondary'}
                accessibilityRole={clickable ? 'link' : undefined}
                onPress={clickable ? () => handleSource(source.url, source.redakcja) : undefined}
                style={styles.source}>
                <EyeDot size={6} /> {source.redakcja ?? source.tytul}
              </ThemedText>
            );
          })}
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  lead: {
    fontFamily: FontFamily.serifItalic,
    fontSize: 17,
    lineHeight: 26,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  chip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  chipText: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headline: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.section,
    lineHeight: FontSize.section * 1.3,
  },
  significance: {
    borderLeftWidth: 2,
    borderRadius: Radius.small,
    paddingLeft: Spacing.three,
    paddingVertical: Spacing.one,
    gap: Spacing.half,
    marginTop: Spacing.one,
  },
  significanceLabel: {
    fontFamily: FontFamily.sansSemiBold,
  },
  sources: {
    gap: Spacing.half,
    marginTop: Spacing.one,
  },
  source: {
    lineHeight: 20,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.five,
  },
  emptyText: {
    textAlign: 'center',
    maxWidth: 360,
  },
});
