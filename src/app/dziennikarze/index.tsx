import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackLink } from '@/components/back-link';
import { EyeDot } from '@/components/eye-dot';
import { FormTextInput } from '@/components/form-text-input';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  FontFamily,
  FontSize,
  KickerStyle,
  MaxContentWidth,
  Radius,
  Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listJournalists, type JournalistListItem } from '@/lib/api/media';

type OutletGroup = {
  outlet: string;
  journalists: JournalistListItem[];
};

/** Do filtrowania bez polskich znaków. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l');
}

/**
 * Dane → Dziennikarze: globalna baza dziennikarzy budowana z publicznych
 * stron autorskich redakcji. Mail ze wzorca redakcji jest jawnie oznaczony
 * jako niezweryfikowany (zasada z migracji journalist_contacts).
 */
export default function JournalistsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [journalists, setJournalists] = useState<JournalistListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const loadJournalists = useCallback(async () => {
    try {
      const list = await listJournalists();
      setJournalists(list);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Nie udało się wczytać bazy dziennikarzy.'
      );
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadJournalists();
    }, [loadJournalists])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadJournalists();
    setRefreshing(false);
  }, [loadJournalists]);

  const handleRetry = () => {
    setLoaded(false);
    setError(null);
    void loadJournalists();
  };

  const groups = useMemo<OutletGroup[]>(() => {
    const q = normalize(query.trim());
    const filtered = q
      ? journalists.filter((journalist) =>
          [
            journalist.full_name,
            journalist.outlet_name ?? '',
            journalist.bio ?? '',
            journalist.topics.join(' '),
          ].some((field) => normalize(field).includes(q))
        )
      : journalists;

    const byOutlet = new Map<string, JournalistListItem[]>();
    for (const journalist of filtered) {
      const outlet = journalist.outlet_name?.trim() || 'Bez redakcji';
      const bucket = byOutlet.get(outlet);
      if (bucket) {
        bucket.push(journalist);
      } else {
        byOutlet.set(outlet, [journalist]);
      }
    }

    return [...byOutlet.entries()]
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'pl'))
      .map(([outlet, list]) => ({
        outlet,
        journalists: [...list].sort((a, b) => a.full_name.localeCompare(b.full_name, 'pl')),
      }));
  }, [journalists, query]);

  const totalShown = groups.reduce((sum, group) => sum + group.journalists.length, 0);

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }>
        <BackLink />

        <View style={styles.header}>
          <ThemedText style={styles.title}>Dziennikarze</ThemedText>
          <ThemedText themeColor="textSecondary">
            Baza dziennikarzy z publicznych stron autorskich redakcji: tematy, bio i kontakty
            zawodowe. Baza rośnie z każdym odświeżeniem źródeł.
          </ThemedText>
        </View>

        <FormTextInput
          label="Szukaj"
          value={query}
          onChangeText={setQuery}
          placeholder="Nazwisko, redakcja, temat..."
          autoCapitalize="none"
          autoCorrect={false}
        />

        {!loaded ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : null}

        {loaded && error && journalists.length === 0 ? (
          <View style={styles.errorBox}>
            <ThemedText type="small" themeColor="error" style={styles.centered}>
              {error}
            </ThemedText>
            <PrimaryButton title="Spróbuj ponownie" variant="secondary" onPress={handleRetry} />
          </View>
        ) : null}

        {loaded && !error && journalists.length === 0 ? (
          <View style={styles.emptyState}>
            <EyeDot size={14} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
              Baza dziennikarzy jest jeszcze pusta. Pojawi się tu po pierwszym przebiegu
              zbierania danych ze stron redakcji.
            </ThemedText>
          </View>
        ) : null}

        {loaded && !error && journalists.length > 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {totalShown} dziennikarzy
          </ThemedText>
        ) : null}

        {loaded && !error && journalists.length > 0 && totalShown === 0 ? (
          <View style={styles.emptyState}>
            <EyeDot size={14} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
              Nikt nie pasuje do tego wyszukiwania.
            </ThemedText>
          </View>
        ) : null}

        {groups.map((group) => (
          <View key={group.outlet} style={styles.group}>
            <View style={styles.sectionHeader}>
              <EyeDot size={8} />
              <ThemedText themeColor="accentLight" style={styles.kicker}>
                {group.outlet}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {group.journalists.length}
              </ThemedText>
            </View>

            {group.journalists.map((journalist) => (
              <View
                key={journalist.id}
                style={[
                  styles.card,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                ]}>
                <ThemedText style={styles.cardName}>{journalist.full_name}</ThemedText>
                {journalist.bio ? (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={3}>
                    {journalist.bio}
                  </ThemedText>
                ) : null}
                {journalist.topics.length > 0 ? (
                  <ThemedText type="small" themeColor="accentLight">
                    {journalist.topics.join(' • ')}
                  </ThemedText>
                ) : null}
                {journalist.email ? (
                  <View style={styles.emailRow}>
                    <ThemedText type="small" selectable>
                      {journalist.email}
                    </ThemedText>
                    {journalist.email_status === 'pattern' ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        adres ze wzorca redakcji, niezweryfikowany
                      </ThemedText>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ))}
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
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.screenTitle,
    lineHeight: FontSize.screenTitle * 1.25,
  },
  centerBox: {
    alignItems: 'center',
    paddingVertical: Spacing.six,
  },
  errorBox: {
    gap: Spacing.three,
    paddingVertical: Spacing.four,
  },
  centered: {
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.five,
  },
  group: {
    gap: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  kicker: {
    ...KickerStyle,
    flexShrink: 1,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  cardName: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.body,
  },
  emailRow: {
    gap: 2,
    marginTop: Spacing.one,
  },
});
