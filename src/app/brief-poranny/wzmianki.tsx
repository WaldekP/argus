import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, FontSize, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { track } from '@/lib/analytics/posthog';
import { listMentions, markMentionsRead, type Mention } from '@/lib/api/mentions';
import { polishPlural } from '@/lib/format';
import { relativeTime } from '@/lib/format-time';
import { openExternalUrl } from '@/lib/open-url';

/**
 * Pełna lista wzmianek prasowych.
 *
 * Powód istnienia: karuzela na Pulpicie pokazuje kilka kafelków z pierwszych
 * pięćdziesięciu nieprzeczytanych, a wzmianek bywa ponad sto. Reszty nie dało
 * się obejrzeć nigdzie w aplikacji, bo `list_mentions` miało w całym kodzie
 * jednego odbiorcę: właśnie tę karuzelę.
 */

/** Ile wzmianek dociągamy na raz. Serwer przyjmuje do 200. */
const PAGE_SIZE = 50;

const TONE_LABEL: Record<NonNullable<Mention['tone']>, string> = {
  przychylna: 'Przychylna',
  krytyczna: 'Krytyczna',
  atak: 'Atak',
  neutralna: 'Neutralna',
};

export default function MentionsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [mentions, setMentions] = useState<Mention[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stan ładowania ustawia przełącznik filtra, a nie ten efekt: synchroniczne
  // setState w efekcie kaskaduje rendery i wywala regułę React Compilera.
  useEffect(() => {
    let active = true;
    listMentions({ only_unread: onlyUnread, limit: PAGE_SIZE })
      .then((result) => {
        if (!active) return;
        setMentions(result.mentions);
        setUnreadTotal(result.unread_total);
        setHasMore(result.mentions.length === PAGE_SIZE);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Nie udało się pobrać wzmianek.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [onlyUnread]);

  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true);
    setError(null);
    try {
      const result = await listMentions({
        only_unread: onlyUnread,
        limit: PAGE_SIZE,
        offset: mentions.length,
      });
      setMentions((current) => [...current, ...result.mentions]);
      setUnreadTotal(result.unread_total);
      setHasMore(result.mentions.length === PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać kolejnych wzmianek.');
    } finally {
      setLoadingMore(false);
    }
  }, [mentions.length, onlyUnread]);

  const handleOpen = useCallback(async (mention: Mention) => {
    track('mention_opened', { source: mention.source_name ?? 'nieznane' });
    // Oznaczamy lokalnie, żeby lista nie skakała pod palcem. Przy filtrze
    // „nieprzeczytane” pozycja zostaje na ekranie do następnego wejścia.
    if (!mention.read_at) {
      setMentions((current) =>
        current.map((item) =>
          item.id === mention.id ? { ...item, read_at: new Date().toISOString() } : item
        )
      );
      setUnreadTotal((current) => Math.max(0, current - 1));
      void markMentionsRead(mention.id).catch(() => undefined);
    }
    await openExternalUrl(mention.url);
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    setMentions((current) =>
      current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() }))
    );
    setUnreadTotal(0);
    try {
      await markMentionsRead();
    } catch {
      // Nieudane oznaczenie nie jest problemem użytkownika: przy następnym
      // wejściu lista pokaże stan z serwera.
    }
  }, []);

  const changeFilter = useCallback(
    (value: boolean) => {
      if (value === onlyUnread) return;
      setOnlyUnread(value);
      setLoading(true);
      setError(null);
    },
    [onlyUnread]
  );

  const filters = [
    { label: 'Wszystkie', value: false },
    { label: 'Nieprzeczytane', value: true },
  ];

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.six },
        ]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Wróć"
          onPress={() => router.back()}
          style={styles.iconButton}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>

        <View style={styles.header}>
          <ThemedText style={styles.title}>Wzmianki</ThemedText>
          <ThemedText themeColor="textSecondary">
            Wszystko, co prasa i sieć napisały o Tobie i Twoich hasłach. Kliknięcie otwiera źródło
            i oznacza wzmiankę jako przeczytaną.
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {unreadTotal > 0
              ? polishPlural(unreadTotal, 'nieprzeczytana', 'nieprzeczytane', 'nieprzeczytanych')
              : 'Wszystko przeczytane.'}
          </ThemedText>
        </View>

        <View style={styles.filterRow}>
          {filters.map((option) => (
            <Pressable
              key={option.label}
              accessibilityRole="button"
              accessibilityState={{ selected: onlyUnread === option.value }}
              onPress={() => changeFilter(option.value)}
              style={[
                styles.filter,
                {
                  borderColor: onlyUnread === option.value ? theme.accent : theme.border,
                  backgroundColor:
                    onlyUnread === option.value ? theme.backgroundSelected : 'transparent',
                },
              ]}>
              <ThemedText
                type="small"
                themeColor={onlyUnread === option.value ? 'accent' : 'textSecondary'}>
                {option.label}
              </ThemedText>
            </Pressable>
          ))}

          {unreadTotal > 0 ? (
            <Pressable accessibilityRole="button" onPress={handleMarkAllRead} style={styles.markAll}>
              <ThemedText type="small" themeColor="accentLight">
                Oznacz wszystkie
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

        {error ? (
          <View style={[styles.alert, { borderLeftColor: theme.error }]}>
            <ThemedText type="small">{error}</ThemedText>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : mentions.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {onlyUnread
              ? 'Nie ma nieprzeczytanych wzmianek.'
              : 'Nie ma jeszcze żadnych wzmianek. Pobierz je na ekranie Hasła.'}
          </ThemedText>
        ) : (
          mentions.map((mention) => (
            <Pressable
              key={mention.id}
              accessibilityRole="link"
              accessibilityLabel={`Otwórz: ${mention.title}`}
              onPress={() => handleOpen(mention)}>
              <ThemedView
                type="backgroundElement"
                style={[styles.card, { borderColor: theme.border }]}>
                <View style={styles.cardHeader}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {mention.source_name ?? 'nieznane źródło'}
                    {mention.published_at ? ` · ${relativeTime(mention.published_at)}` : ''}
                  </ThemedText>
                  {mention.tone ? (
                    <View style={[styles.chip, { borderColor: theme.border }]}>
                      <ThemedText type="small" themeColor="textSecondary">
                        {TONE_LABEL[mention.tone]}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>

                <ThemedText style={mention.read_at ? styles.titleRead : styles.titleUnread}>
                  {mention.title}
                </ThemedText>

                {mention.snippet ? (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={3}>
                    {mention.snippet}
                  </ThemedText>
                ) : (
                  // Brand24 nie oddaje treści wpisów z X, Facebooka i Instagrama
                  // (regulaminy tych platform), a bez tego zdania karta wygląda
                  // na uszkodzoną, zamiast na kompletną informację o tym, że
                  // treść trzeba przeczytać u źródła.
                  <ThemedText type="small" themeColor="textSecondary">
                    Treści tego wpisu nie udostępnia monitoring. Otwórz źródło, żeby ją zobaczyć.
                  </ThemedText>
                )}
              </ThemedView>
            </Pressable>
          ))
        )}

        {!loading && hasMore ? (
          <PrimaryButton
            title="Pokaż starsze"
            variant="secondary"
            onPress={handleLoadMore}
            loading={loadingMore}
          />
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  iconButton: {
    padding: Spacing.one,
    alignSelf: 'flex-start',
  },
  header: {
    gap: Spacing.two,
  },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.screenTitle,
    lineHeight: FontSize.screenTitle * 1.25,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  filter: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  markAll: {
    marginLeft: 'auto',
    paddingVertical: Spacing.one,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  titleUnread: {
    fontFamily: FontFamily.sansSemiBold,
  },
  titleRead: {
    fontFamily: FontFamily.sans,
  },
  alert: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.three,
    paddingVertical: Spacing.two,
  },
  centered: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
});
