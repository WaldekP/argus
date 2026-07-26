import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import {
  getStatement,
  listStatements,
  type StatementListItem,
} from '@/lib/api/onboarding';
import { formatDate, polishPlural } from '@/lib/format';
import { openExternalUrl } from '@/lib/open-url';

const PAGE_SIZE = 20;

type RowProps = {
  statement: StatementListItem;
  expanded: boolean;
  fullText: string | null;
  loadingFull: boolean;
  onToggle: () => void;
};

/**
 * Wiersz wystąpienia: data, fragment i pełna treść po rozwinięciu.
 * Pełny tekst dociągamy dopiero na żądanie, bo stenogramy bywają długie.
 */
function StatementRow({ statement, expanded, fullText, loadingFull, onToggle }: RowProps) {
  const theme = useTheme();
  const date = statement.date ? formatDate(statement.date) : 'bez daty';

  return (
    <ThemedView type="backgroundElement" style={[styles.row, { borderColor: theme.border }]}>
      <ThemedText themeColor="accentLight" style={styles.rowDate}>
        {date}
      </ThemedText>

      <ThemedText type="small" themeColor="text80">
        {expanded && fullText ? fullText : statement.excerpt}
        {!expanded && statement.truncated ? '…' : ''}
      </ThemedText>

      <View style={styles.rowActions}>
        {statement.truncated ? (
          <Pressable accessibilityRole="button" onPress={onToggle} style={styles.rowAction}>
            {loadingFull ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={theme.accent}
              />
            )}
            <ThemedText type="small" themeColor="accent">
              {expanded ? 'Zwiń' : 'Rozwiń całość'}
            </ThemedText>
          </Pressable>
        ) : null}

        {statement.url ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => void openExternalUrl(statement.url as string)}
            style={styles.rowAction}>
            <Ionicons name="open-outline" size={16} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">
              Stenogram w Sejmie
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </ThemedView>
  );
}

/**
 * Wystąpienia sejmowe polityka: to, co Argus ma w bazie i czym karmi briefy,
 * generator przekazu i strażnika spójności. Wejście z karty mandatu w Profilu.
 */
export default function StatementsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [statements, setStatements] = useState<StatementListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fullTexts, setFullTexts] = useState<Record<string, string>>({});
  const [loadingFullId, setLoadingFullId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listStatements({ limit: PAGE_SIZE, offset: 0 })
      .then((page) => {
        if (!active) return;
        setStatements(page.statements);
        setTotal(page.total);
        setHasMore(page.has_more);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Nie udało się pobrać wystąpień.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true);
    setError(null);
    try {
      const page = await listStatements({ limit: PAGE_SIZE, offset: statements.length });
      setStatements((current) => [...current, ...page.statements]);
      setTotal(page.total);
      setHasMore(page.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać kolejnych wystąpień.');
    } finally {
      setLoadingMore(false);
    }
  }, [statements.length]);

  const handleToggle = useCallback(
    async (statement: StatementListItem) => {
      if (expandedId === statement.id) {
        setExpandedId(null);
        return;
      }
      setExpandedId(statement.id);
      if (fullTexts[statement.id]) {
        return;
      }
      setLoadingFullId(statement.id);
      try {
        const full = await getStatement(statement.id);
        setFullTexts((current) => ({ ...current, [statement.id]: full.text }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Nie udało się pobrać treści wystąpienia.');
        setExpandedId(null);
      } finally {
        setLoadingFullId(null);
      }
    },
    [expandedId, fullTexts],
  );

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
          <ThemedText themeColor="accent" style={styles.kicker}>
            Twoja historia w Sejmie
          </ThemedText>
          <ThemedText style={styles.title}>Wystąpienia</ThemedText>
          <ThemedText themeColor="textSecondary">
            {loading
              ? 'Pobieram wystąpienia ze stenogramów.'
              : `Argus ma w bazie ${polishPlural(total, 'wystąpienie', 'wystąpienia', 'wystąpień')} ze stenogramów Sejmu. Na tej treści opiera profil stylu i alerty spójności.`}
          </ThemedText>
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
        ) : statements.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="eye-outline" size={40} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
              Nie ma jeszcze żadnych wystąpień. Uruchom import danych z Sejmu w onboardingu, a
              Argus pobierze stenogramy.
            </ThemedText>
          </View>
        ) : (
          <>
            <View style={styles.list}>
              {statements.map((statement) => (
                <StatementRow
                  key={statement.id}
                  statement={statement}
                  expanded={expandedId === statement.id}
                  fullText={fullTexts[statement.id] ?? null}
                  loadingFull={loadingFullId === statement.id}
                  onToggle={() => void handleToggle(statement)}
                />
              ))}
            </View>

            {hasMore ? (
              <PrimaryButton
                title="Pokaż starsze"
                variant="secondary"
                onPress={() => void handleLoadMore()}
                loading={loadingMore}
              />
            ) : null}
          </>
        )}
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
    alignSelf: 'flex-start',
    padding: Spacing.two,
    marginLeft: -Spacing.two,
  },
  header: {
    gap: Spacing.two,
  },
  kicker: {
    ...KickerStyle,
  },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.screenTitle,
    lineHeight: FontSize.screenTitle * 1.25,
  },
  alert: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.three,
    paddingVertical: Spacing.two,
  },
  centered: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.six,
  },
  centeredText: {
    textAlign: 'center',
  },
  list: {
    gap: Spacing.three,
  },
  row: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  rowDate: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 12,
    letterSpacing: 12 * 0.24,
    textTransform: 'uppercase',
  },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.four,
    marginTop: Spacing.one,
  },
  rowAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
