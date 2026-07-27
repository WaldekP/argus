import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { track } from '@/lib/analytics/posthog';
import { getDailyBrief, type DailyBrief } from '@/lib/api/daily-brief';
import { listMentions, markMentionsRead, type Mention } from '@/lib/api/mentions';
import { relativeTime } from '@/lib/format-time';
import { openExternalUrl } from '@/lib/open-url';

/** Ile kart maksymalnie pokazujemy w jednej karuzeli na Pulpicie. */
const CAROUSEL_LIMIT = 10;

/**
 * Sekcja briefu porannego na Pulpicie: klocki dzisiejszego briefu widoczne od
 * razu, w formie poziomych karuzel. Dwie karuzele: wydarzenia z przeglądu dnia
 * (dotknięcie otwiera pełny brief) i nieprzeczytane wzmianki prasowe
 * (dotknięcie otwiera artykuł i oznacza wzmiankę jako przeczytaną).
 *
 * Link „Wszystkie" prowadzi do archiwum wszystkich briefów dnia.
 */
export function MorningBriefSection() {
  const theme = useTheme();
  const router = useRouter();

  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(true);
  const [mentions, setMentions] = useState<Mention[]>([]);

  // Odświeżamy przy każdym wejściu w zakładkę, nie tylko przy montażu:
  // użytkownik wraca z briefu po wygenerowaniu przeglądu albo przeczytaniu
  // wzmianek i karuzele mają pokazać aktualny stan.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getDailyBrief()
        .then((result) => {
          if (active) setBrief(result.brief);
        })
        .catch(() => undefined)
        .finally(() => {
          if (active) setBriefLoading(false);
        });
      listMentions({ only_unread: true, limit: 50 })
        .then((result) => {
          if (active) setMentions(result.mentions);
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, []),
  );

  const handleOpenMention = useCallback(async (mention: Mention) => {
    track('mention_opened', { source: mention.source_name ?? 'nieznane' });
    // Wzmianka znika z karuzeli od razu: karuzela pokazuje tylko nieprzeczytane.
    setMentions((current) => current.filter((item) => item.id !== mention.id));
    void markMentionsRead(mention.id).catch(() => undefined);
    await openExternalUrl(mention.url);
  }, []);

  const briefItems = useMemo(
    () => (brief?.status === 'ready' ? brief.items.slice(0, CAROUSEL_LIMIT) : []),
    [brief],
  );
  const carouselMentions = useMemo(() => mentions.slice(0, CAROUSEL_LIMIT), [mentions]);

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <ThemedText style={styles.title}>Brief poranny</ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Wszystkie briefy"
          onPress={() => router.push('/brief-poranny/archiwum')}
          hitSlop={8}>
          <ThemedText type="small" themeColor="accentLight">
            Wszystkie
          </ThemedText>
        </Pressable>
      </View>

      {briefLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : briefItems.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.carousel}
          contentContainerStyle={styles.carouselContent}>
          {briefItems.map((item, index) => (
            <Pressable
              key={`${item.naglowek}-${index}`}
              accessibilityRole="button"
              accessibilityLabel={`Otwórz brief poranny: ${item.naglowek}`}
              onPress={() => router.push('/brief-poranny')}
              style={({ pressed }) => [
                styles.carouselCard,
                {
                  backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
                  borderColor: theme.border,
                },
              ]}>
              <View style={[styles.chip, { borderColor: theme.accent }]}>
                <ThemedText type="small" themeColor="accentLight" style={styles.chipText}>
                  {item.kategoria}
                </ThemedText>
              </View>
              <ThemedText style={styles.headline} numberOfLines={2}>
                {item.naglowek}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={4}>
                {item.streszczenie}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Otwórz brief poranny"
          onPress={() => router.push('/brief-poranny')}
          style={({ pressed }) => [
            styles.emptyCard,
            {
              backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
              borderColor: theme.border,
            },
          ]}>
          <ThemedText type="small" themeColor="textSecondary">
            {brief?.status === 'generating'
              ? 'Przegląd dnia w przygotowaniu. Zajrzyj za chwilę.'
              : 'Nie ma jeszcze przeglądu na dziś. Otwórz brief poranny, aby go wygenerować.'}
          </ThemedText>
        </Pressable>
      )}

      {carouselMentions.length > 0 ? (
        <>
          <View style={styles.titleRow}>
            <ThemedText type="smallBold">Wzmianki o Tobie</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {mentions.length} nowych
            </ThemedText>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.carousel}
            contentContainerStyle={styles.carouselContent}>
            {carouselMentions.map((mention) => (
              <Pressable
                key={mention.id}
                accessibilityRole="link"
                accessibilityLabel={`Otwórz artykuł: ${mention.title}`}
                onPress={() => handleOpenMention(mention)}
                style={({ pressed }) => [
                  styles.carouselCard,
                  {
                    backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
                    borderColor: theme.border,
                  },
                ]}>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {mention.source_name ?? 'źródło nieznane'} · {relativeTime(mention.published_at)}
                </ThemedText>
                <ThemedText style={styles.mentionTitle} numberOfLines={4}>
                  {mention.title}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Otwórz dzisiejszy brief poranny"
        onPress={() => router.push('/brief-poranny')}
        hitSlop={8}
        style={styles.todayLink}>
        <ThemedText type="small" themeColor="accentLight">
          Dzisiejszy brief w całości
        </ThemedText>
        <Ionicons name="arrow-forward" size={14} color={theme.accentLight} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.section,
    lineHeight: FontSize.section * 1.3,
  },
  loading: {
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
  // Karuzela wyjeżdża poza padding ekranu, żeby karty chowały się przy krawędzi.
  carousel: {
    marginHorizontal: -Spacing.four,
  },
  carouselContent: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  carouselCard: {
    width: 280,
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  headline: {
    fontFamily: FontFamily.serif,
    fontSize: 18,
    lineHeight: 24,
  },
  mentionTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 15,
    lineHeight: 22,
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
  todayLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
  },
});
