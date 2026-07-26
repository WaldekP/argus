import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { DraftStatusChip } from '@/components/draft-status-chip';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listDrafts, type DraftListItem } from '@/lib/api/content';
import { formatDate, polishPlural } from '@/lib/format';

type Props = {
  /** Filtr po temacie (slug korpusu albo `dossier:<uuid>`). Brak = wszystkie. */
  topicRef?: string;
  /** Tekst pustego stanu. */
  emptyText: string;
};

/**
 * Lista zapisanych przekazów. Z `topicRef` pokazuje przekazy jednego tematu,
 * bez niego wszystkie przekazy tenanta. Odświeża się przy każdym wejściu na
 * ekran (powrót z generacji albo widoku wariantu).
 */
export function SavedDraftsList({ topicRef, emptyText }: Props) {
  const theme = useTheme();
  const router = useRouter();

  const [drafts, setDrafts] = useState<DraftListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await listDrafts(topicRef);
      setDrafts(list);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Nie udało się wczytać przekazów.'
      );
    } finally {
      setLoaded(true);
    }
  }, [topicRef]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (!loaded) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (error && drafts.length === 0) {
    return (
      <ThemedText type="small" themeColor="error">
        {error}
      </ThemedText>
    );
  }

  if (drafts.length === 0) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        {emptyText}
      </ThemedText>
    );
  }

  return (
    <View style={styles.cards}>
      {drafts.map((draft) => (
        <Pressable
          key={draft.id}
          accessibilityRole="button"
          onPress={() => router.push(`/content/${draft.id}`)}
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            pressed && styles.dimmed,
          ]}>
          <ThemedText style={styles.cardTopic}>{draft.topic}</ThemedText>
          <DraftStatusChip status={draft.status} />
          <View style={styles.cardMeta}>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDate(draft.created_at)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {polishPlural(draft.variants_count, 'wariant', 'warianty', 'wariantów')}
            </ThemedText>
            {draft.alerts_count > 0 ? (
              <ThemedText type="small" themeColor="error">
                {polishPlural(
                  draft.alerts_count,
                  'alert spójności',
                  'alerty spójności',
                  'alertów spójności'
                )}
              </ThemedText>
            ) : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  centerBox: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  cards: {
    gap: Spacing.three,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  cardTopic: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.section,
    lineHeight: FontSize.section * 1.3,
  },
  cardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  dimmed: {
    opacity: 0.7,
  },
});
