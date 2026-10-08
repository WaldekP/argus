import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackLink } from '@/components/back-link';
import { EyeDot } from '@/components/eye-dot';
import { PrimaryButton } from '@/components/primary-button';
import { StatusChip } from '@/components/status-chip';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, FontSize, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listDossiers, type OpponentDossierListItem } from '@/lib/api/opponents';
import { formatDate, polishPlural } from '@/lib/format';

/** Lista teczek oponentów biura + wejście do nowej teczki. */
export default function OpponentListScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [dossiers, setDossiers] = useState<OpponentDossierListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDossiers(await listDossiers());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Nie udało się wczytać teczek.');
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

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
          <ThemedText style={styles.title}>Teczki oponentów</ThemedText>
          <ThemedText themeColor="textSecondary">
            Wypowiedzi przeciwnika z ostatniego roku, zebrane z sieci: kontrowersje, sprzeczności
            z programem jego partii i to, co podważyły późniejsze fakty. Każda pozycja ma źródło.
          </ThemedText>
        </View>

        <PrimaryButton title="Nowa teczka" onPress={() => router.push('/oponenci/nowa')} />

        {!loaded ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : null}

        {loaded && error && dossiers.length === 0 ? (
          <View style={styles.errorBox}>
            <ThemedText type="small" themeColor="error" style={styles.centered}>
              {error}
            </ThemedText>
            <PrimaryButton
              title="Spróbuj ponownie"
              variant="secondary"
              onPress={() => void load()}
            />
          </View>
        ) : null}

        {loaded && !error && dossiers.length === 0 ? (
          <View style={styles.emptyState}>
            <EyeDot size={14} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
              Nie masz jeszcze żadnej teczki. Podaj, z kim będziesz rozmawiać, a Argus zbierze jego
              wypowiedzi z ostatniego roku.
            </ThemedText>
          </View>
        ) : null}

        {dossiers.length > 0 ? (
          <View style={styles.cards}>
            {dossiers.map((dossier) => (
              <Pressable
                key={dossier.id}
                accessibilityRole="button"
                onPress={() => router.push(`/oponenci/${dossier.id}`)}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  pressed && styles.dimmed,
                ]}>
                <View style={styles.cardHeader}>
                  <ThemedText style={styles.cardName}>{dossier.full_name}</ThemedText>
                  {dossier.status === 'collecting' ? (
                    <StatusChip label="W przygotowaniu" color="accent" />
                  ) : null}
                </View>
                {dossier.role_hint || dossier.party ? (
                  <ThemedText type="small" themeColor="text80">
                    {[dossier.role_hint, dossier.party].filter(Boolean).join(', ')}
                  </ThemedText>
                ) : null}
                <ThemedText type="small" themeColor="textSecondary">
                  {dossier.items_count}{' '}
                  {polishPlural(dossier.items_count, 'wypowiedź', 'wypowiedzi', 'wypowiedzi')},
                  stan na {formatDate(dossier.updated_at)}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  header: { gap: Spacing.two },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.screenTitle,
    lineHeight: FontSize.screenTitle * 1.25,
  },
  centerBox: { paddingVertical: Spacing.six, alignItems: 'center' },
  errorBox: { gap: Spacing.three, alignItems: 'center' },
  emptyState: { gap: Spacing.three, alignItems: 'center', paddingVertical: Spacing.five },
  centered: { textAlign: 'center' },
  cards: { gap: Spacing.three },
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cardName: { fontFamily: FontFamily.sansSemiBold, flexShrink: 1 },
  dimmed: { opacity: 0.7 },
});
