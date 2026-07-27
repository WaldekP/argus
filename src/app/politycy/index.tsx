import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, View } from 'react-native';
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
import { listMps, type MpListItem } from '@/lib/api/onboarding';

type ClubSection = {
  title: string;
  data: MpListItem[];
};

/** Do filtrowania bez polskich znaków: "olesnica" znajdzie "Oleśnicę". */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l');
}

/**
 * Dane → Politycy: wszyscy posłowie obecnej kadencji na żywo z API Sejmu,
 * z wyszukiwarką i grupowaniem po klubach. Bez zdjęć (decyzja usera
 * 2026-07-24: zdjęcie tylko na karcie mandatu w Profilu).
 */
export default function PoliticiansScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [mps, setMps] = useState<MpListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const loadMps = useCallback(async () => {
    try {
      const list = await listMps();
      setMps(list);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Nie udało się wczytać listy posłów.'
      );
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadMps();
    }, [loadMps])
  );

  const handleRetry = () => {
    setLoaded(false);
    setError(null);
    void loadMps();
  };

  const sections = useMemo<ClubSection[]>(() => {
    const q = normalize(query.trim());
    const active = mps.filter((mp) => mp.active);
    const filtered = q
      ? active.filter((mp) =>
          [mp.full_name, mp.club ?? '', mp.district_name ?? '', mp.voivodeship ?? ''].some(
            (field) => normalize(field).includes(q)
          )
        )
      : active;

    const byClub = new Map<string, MpListItem[]>();
    for (const mp of filtered) {
      const club = mp.club?.trim() || 'Bez klubu';
      const bucket = byClub.get(club);
      if (bucket) {
        bucket.push(mp);
      } else {
        byClub.set(club, [mp]);
      }
    }

    return [...byClub.entries()]
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'pl'))
      .map(([title, data]) => ({
        title,
        data: [...data].sort((a, b) => a.full_name.localeCompare(b.full_name, 'pl')),
      }));
  }, [mps, query]);

  const totalShown = sections.reduce((sum, section) => sum + section.data.length, 0);

  return (
    <ThemedView style={styles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.mp_id)}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four },
        ]}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <BackLink />
            <View style={styles.header}>
              <ThemedText style={styles.title}>Politycy</ThemedText>
              <ThemedText themeColor="textSecondary">
                Posłowie obecnej kadencji, na żywo z API Sejmu. Wyszukasz po nazwisku, klubie,
                okręgu albo województwie.
              </ThemedText>
            </View>

            <FormTextInput
              label="Szukaj"
              value={query}
              onChangeText={setQuery}
              placeholder="Nazwisko, klub, okręg..."
              autoCapitalize="none"
              autoCorrect={false}
            />

            {!loaded ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={theme.accent} />
              </View>
            ) : null}

            {loaded && error && mps.length === 0 ? (
              <View style={styles.errorBox}>
                <ThemedText type="small" themeColor="error" style={styles.centered}>
                  {error}
                </ThemedText>
                <PrimaryButton title="Spróbuj ponownie" variant="secondary" onPress={handleRetry} />
              </View>
            ) : null}

            {loaded && !error ? (
              <ThemedText type="small" themeColor="textSecondary">
                {totalShown} posłów
              </ThemedText>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loaded && !error ? (
            <View style={styles.emptyState}>
              <EyeDot size={14} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
                Nikt nie pasuje do tego wyszukiwania.
              </ThemedText>
            </View>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <EyeDot size={8} />
            <ThemedText themeColor="accentLight" style={styles.kicker}>
              {section.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {section.data.length}
            </ThemedText>
          </View>
        )}
        renderItem={({ item }) => (
          <View
            style={[
              styles.row,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}>
            <View style={styles.rowTexts}>
              <ThemedText style={styles.rowName}>{item.full_name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {[item.district_name ? `okręg ${item.district_name}` : null, item.voivodeship]
                  .filter(Boolean)
                  .join(', ')}
              </ThemedText>
            </View>
            {item.number_of_votes ? (
              <View style={styles.rowVotes}>
                <ThemedText type="small" themeColor="accentLight">
                  {item.number_of_votes.toLocaleString('pl-PL')}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  głosów
                </ThemedText>
              </View>
            ) : null}
          </View>
        )}
      />
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
    gap: Spacing.two,
  },
  headerBlock: {
    gap: Spacing.four,
    marginBottom: Spacing.two,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
  },
  kicker: {
    ...KickerStyle,
    flexShrink: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.two,
  },
  rowTexts: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontFamily: FontFamily.sansSemiBold,
  },
  rowVotes: {
    alignItems: 'flex-end',
  },
});
