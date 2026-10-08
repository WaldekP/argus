import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackLink } from '@/components/back-link';
import { PrimaryButton } from '@/components/primary-button';
import { InlineProgress } from '@/components/progress';
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
import { track } from '@/lib/analytics/posthog';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  deleteDossier,
  getDossier,
  refreshDossier,
  runDossier,
  type DossierCategory,
  type DossierItem,
  type OpponentDossier,
} from '@/lib/api/opponents';
import { formatDate, polishPlural } from '@/lib/format';
import { formatItemDate, isParaphrase, quoteText, sourceHost } from '@/lib/opponent-format';

type Theme = ReturnType<typeof useTheme>;

/** Sortowanie od najnowszej; pozycje bez daty na końcu. */
function byDateDesc(a: DossierItem, b: DossierItem): number {
  if (a.date === b.date) return 0;
  if (a.date === null) return 1;
  if (b.date === null) return -1;
  return a.date < b.date ? 1 : -1;
}

export default function OpponentDossierScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();

  const [dossier, setDossier] = useState<OpponentDossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<DossierCategory | 'all'>('all');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const runningRef = useRef(false);
  const viewedRef = useRef(false);

  const load = useCallback(async (id: string) => {
    const result = await getDossier(id);
    setDossier(result);
    return result;
  }, []);

  /**
   * Pętla przebiegów. Startuje sama, gdy teczka jest w przygotowaniu, także
   * po powrocie na ekran: serwer pamięta, który przebieg jest następny.
   * Ref pilnuje, żeby nie odpalić drugiej pętli równolegle.
   */
  const run = useCallback(
    async (id: string) => {
      if (runningRef.current) return;
      runningRef.current = true;
      setRunning(true);
      setError(null);
      try {
        await runDossier(id, () => {
          void load(id);
        });
        await load(id);
      } catch (runError) {
        setError(
          runError instanceof Error
            ? runError.message
            : 'Przygotowanie teczki zatrzymało się. Spróbuj wznowić.'
        );
      } finally {
        runningRef.current = false;
        setRunning(false);
      }
    },
    [load]
  );

  useEffect(() => {
    if (!params.id) return;
    let active = true;
    getDossier(params.id)
      .then((result) => {
        if (!active) return;
        setDossier(result);
        if (!viewedRef.current) {
          viewedRef.current = true;
          track('opponent_dossier_viewed', {
            status: result.status,
            pozycji: result.items.length,
          });
        }
        if (result.status === 'collecting') void run(params.id);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Nie udało się pobrać teczki.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params.id, run]);

  const handleRefresh = useCallback(async () => {
    if (!dossier) return;
    try {
      await refreshDossier(dossier.id);
      track('opponent_dossier_refreshed', { pozycji: dossier.items.length });
      await load(dossier.id);
      void run(dossier.id);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error ? refreshError.message : 'Nie udało się odświeżyć teczki.'
      );
    }
  }, [dossier, load, run]);

  const handleDelete = useCallback(async () => {
    if (!dossier) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await deleteDossier(dossier.id);
      router.replace('/oponenci');
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : 'Nie udało się usunąć teczki.'
      );
    }
  }, [confirmDelete, dossier, router]);

  const itemsById = useMemo(
    () => new Map((dossier?.items ?? []).map((item) => [item.id, item])),
    [dossier]
  );

  const counts = useMemo(() => {
    const out = new Map<DossierCategory, number>();
    for (const item of dossier?.items ?? []) {
      out.set(item.category, (out.get(item.category) ?? 0) + 1);
    }
    return out;
  }, [dossier]);

  const visibleItems = useMemo(
    () =>
      (dossier?.items ?? [])
        .filter((item) => filter === 'all' || item.category === filter)
        .sort(byDateDesc),
    [dossier, filter]
  );

  const openSource = useCallback((url: string, kind: 'cytat' | 'fakt') => {
    track('opponent_item_source_opened', { rodzaj: kind });
    void Linking.openURL(url);
  }, []);

  const summary = dossier?.summary ?? null;
  const collecting = dossier?.status === 'collecting';
  const currentPass =
    dossier && dossier.pass_index < dossier.passes.length
      ? dossier.passes[dossier.pass_index].label
      : null;
  const gaps = [
    ...(summary?.luki ?? []),
    ...(summary?.failed_passes ?? []).map(
      (label) => `Przebieg „${label}” się nie powiódł, ta część nie została sprawdzona.`
    ),
  ];

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.six },
        ]}>
        <BackLink />

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : null}

        {error ? (
          <View style={[styles.alert, { borderLeftColor: theme.error }]}>
            <ThemedText type="small">{error}</ThemedText>
            {collecting && !running && dossier ? (
              <PrimaryButton
                title="Wznów przygotowanie"
                variant="secondary"
                onPress={() => void run(dossier.id)}
              />
            ) : null}
          </View>
        ) : null}

        {dossier ? (
          <>
            <View style={styles.header}>
              <ThemedText type="small" themeColor="accentLight" style={KickerStyle}>
                TECZKA OPONENTA
              </ThemedText>
              <ThemedText style={styles.title}>{dossier.full_name}</ThemedText>
              {dossier.role_hint || dossier.party ? (
                <ThemedText themeColor="text80">
                  {[dossier.role_hint, dossier.party].filter(Boolean).join(', ')}
                </ThemedText>
              ) : null}
              <ThemedText type="small" themeColor="textSecondary">
                {dossier.items.length}{' '}
                {polishPlural(dossier.items.length, 'wypowiedź', 'wypowiedzi', 'wypowiedzi')} z{' '}
                {dossier.search_count}{' '}
                {polishPlural(dossier.search_count, 'wyszukiwania', 'wyszukiwań', 'wyszukiwań')},
                stan na {formatDate(dossier.updated_at)}
              </ThemedText>
            </View>

            {collecting ? (
              <InlineProgress
                label={
                  currentPass
                    ? `Szukam: ${currentPass}. Całość trwa kilka minut, nie zamykaj ekranu.`
                    : 'Kończę przygotowanie.'
                }
                processed={dossier.pass_index}
                total={dossier.passes.length}
              />
            ) : null}

            {dossier.status === 'error' ? (
              <View style={[styles.alert, { borderLeftColor: theme.error }]}>
                <ThemedText type="small">
                  {dossier.error ?? 'Przygotowanie teczki zatrzymało się.'} Zebrane dotąd
                  wypowiedzi zostają, odświeżenie dołoży brakujące.
                </ThemedText>
              </View>
            ) : null}

            <View style={[styles.note, { borderLeftColor: theme.teal }]}>
              <ThemedText type="small" themeColor="text80">
                Wypowiedzi zebrano automatycznie z wyszukiwarki. Każdy adres pochodzi z wyników
                wyszukiwania, ale przed użyciem cytatu na antenie otwórz źródło i sprawdź brzmienie.
              </ThemedText>
            </View>

            {summary?.linia ? (
              <Section title="LINIA">
                <Card theme={theme}>
                  <ThemedText type="small">{summary.linia}</ThemedText>
                </Card>
              </Section>
            ) : null}

            {summary?.punkty_ataku && summary.punkty_ataku.length > 0 ? (
              <Section title="PUNKTY ATAKU">
                {summary.punkty_ataku.map((point, index) => (
                  <Card key={index} theme={theme}>
                    <ThemedText style={styles.strong}>{point.teza}</ThemedText>
                    {point.jak_uzyc ? (
                      <ThemedText type="small" themeColor="text80">
                        {point.jak_uzyc}
                      </ThemedText>
                    ) : null}
                    {point.obrona_przeciwnika ? (
                      <View style={[styles.risk, { borderLeftColor: theme.error }]}>
                        <ThemedText type="small">
                          Co odpowie: {point.obrona_przeciwnika}
                        </ThemedText>
                      </View>
                    ) : null}
                    {point.item_ids.map((itemId) => {
                      const item = itemsById.get(itemId);
                      if (!item) return null;
                      return (
                        <Pressable
                          key={itemId}
                          accessibilityRole="link"
                          onPress={() => openSource(item.source_url, 'cytat')}>
                          <ThemedText type="small" themeColor="accentLight">
                            {formatItemDate(item.date)}, {sourceHost(item.source_url)}:{' '}
                            {quoteText(item.quote).slice(0, 120)}
                            {item.quote.length > 120 ? '…' : ''}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </Card>
                ))}
              </Section>
            ) : null}

            {summary?.czego_unikac && summary.czego_unikac.length > 0 ? (
              <Section title="CZEGO NIE PRÓBOWAĆ">
                <Card theme={theme}>
                  {summary.czego_unikac.map((line, index) => (
                    <ThemedText key={index} type="small">
                      {line}
                    </ThemedText>
                  ))}
                </Card>
              </Section>
            ) : null}

            {dossier.items.length > 0 ? (
              <Section title="WYPOWIEDZI">
                <View style={styles.chips}>
                  <Chip
                    label={`Wszystkie (${dossier.items.length})`}
                    active={filter === 'all'}
                    onPress={() => setFilter('all')}
                    theme={theme}
                  />
                  {CATEGORY_ORDER.filter((category) => counts.has(category)).map((category) => (
                    <Chip
                      key={category}
                      label={`${CATEGORY_LABELS[category]} (${counts.get(category)})`}
                      active={filter === category}
                      onPress={() => setFilter(category)}
                      theme={theme}
                    />
                  ))}
                </View>
                {visibleItems.map((item) => (
                  <ItemCard key={item.id} item={item} theme={theme} onOpen={openSource} />
                ))}
              </Section>
            ) : !collecting ? (
              <Card theme={theme}>
                <ThemedText type="small" themeColor="textSecondary">
                  Wyszukiwanie nie znalazło wypowiedzi tej osoby z ostatniego roku. Sprawdź pisownię
                  nazwiska, dodaj funkcję albo partię i odśwież teczkę.
                </ThemedText>
              </Card>
            ) : null}

            {gaps.length > 0 ? (
              <Section title="CZEGO TECZKA NIE OBEJMUJE">
                <Card theme={theme}>
                  {gaps.map((line, index) => (
                    <ThemedText key={index} type="small" themeColor="text80">
                      {line}
                    </ThemedText>
                  ))}
                </Card>
              </Section>
            ) : null}

            {summary?.identity_notes && summary.identity_notes.length > 0 ? (
              <Section title="UWAGI Z WYSZUKIWANIA">
                <Card theme={theme}>
                  {summary.identity_notes.map((line, index) => (
                    <ThemedText key={index} type="small" themeColor="textSecondary">
                      {line}
                    </ThemedText>
                  ))}
                </Card>
              </Section>
            ) : null}

            {!collecting ? (
              <View style={styles.actions}>
                <PrimaryButton
                  title="Odśwież teczkę"
                  variant="secondary"
                  onPress={() => void handleRefresh()}
                  disabled={running}
                />
                <PrimaryButton
                  title={confirmDelete ? 'Potwierdź usunięcie teczki' : 'Usuń teczkę'}
                  variant="secondary"
                  onPress={() => void handleDelete()}
                />
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

function ItemCard({
  item,
  theme,
  onOpen,
}: {
  item: DossierItem;
  theme: Theme;
  onOpen: (url: string, kind: 'cytat' | 'fakt') => void;
}) {
  const paraphrase = isParaphrase(item.quote);
  return (
    <Card theme={theme}>
      <View style={styles.itemHeader}>
        <ThemedText type="small" themeColor="accentLight">
          {CATEGORY_LABELS[item.category]}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatItemDate(item.date)}
        </ThemedText>
      </View>
      {paraphrase ? (
        <ThemedText type="small" themeColor="text80">
          Parafraza: {quoteText(item.quote)}
        </ThemedText>
      ) : (
        <ThemedText style={styles.quote}>„{quoteText(item.quote)}”</ThemedText>
      )}
      {item.context ? (
        <ThemedText type="small" themeColor="textSecondary">
          {item.context}
        </ThemedText>
      ) : null}
      {item.why_it_matters ? (
        <ThemedText type="small" themeColor="text80">
          Jak wykorzystać: {item.why_it_matters}
        </ThemedText>
      ) : null}
      {item.later_facts ? (
        <View style={[styles.later, { borderLeftColor: theme.teal }]}>
          <ThemedText type="small">Później: {item.later_facts}</ThemedText>
          {item.later_facts_url ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => onOpen(item.later_facts_url as string, 'fakt')}>
              <ThemedText type="small" themeColor="accentLight">
                {sourceHost(item.later_facts_url)}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <Pressable accessibilityRole="link" onPress={() => onOpen(item.source_url, 'cytat')}>
        <ThemedText type="small" themeColor="accentLight">
          Źródło: {item.source_title || sourceHost(item.source_url)} ({sourceHost(item.source_url)})
        </ThemedText>
      </Pressable>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="small" themeColor="textSecondary" style={KickerStyle}>
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

function Card({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
      {children}
    </ThemedView>
  );
}

function Chip({
  label,
  active,
  onPress,
  theme,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  theme: Theme;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: active ? theme.accent : theme.border,
          backgroundColor: active ? theme.backgroundSelected : 'transparent',
        },
      ]}>
      <ThemedText type="small" themeColor={active ? 'accent' : 'textSecondary'}>
        {label}
      </ThemedText>
    </Pressable>
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
  section: { gap: Spacing.two },
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  strong: { fontFamily: FontFamily.sansSemiBold },
  quote: { fontFamily: FontFamily.serifItalic, fontSize: FontSize.body + 1 },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  risk: { borderLeftWidth: 2, paddingLeft: Spacing.two },
  later: { borderLeftWidth: 2, paddingLeft: Spacing.two, gap: Spacing.one },
  note: { borderLeftWidth: 2, paddingLeft: Spacing.three, paddingVertical: Spacing.two },
  alert: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    minHeight: 36,
    justifyContent: 'center',
  },
  actions: { gap: Spacing.three, paddingTop: Spacing.two },
  centered: { paddingVertical: Spacing.six, alignItems: 'center' },
});
