import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, FontSize, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listBriefs, type BriefListItem } from '@/lib/api/brief';
import { formatLongDate } from '@/lib/format-time';

/** Lista briefów przedwywiadowych. Wejście: Analizy → Brief przedwywiadowy. */
export default function BriefListScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [briefs, setBriefs] = useState<BriefListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listBriefs()
      .then((result) => {
        if (active) setBriefs(result);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Nie udało się pobrać briefów.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const statusLabel = (b: BriefListItem) =>
    b.status === 'ready' ? 'Gotowy' : b.status === 'generating' ? 'W przygotowaniu' : 'Błąd';

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
          <ThemedText style={styles.title}>Brief przedwywiadowy</ThemedText>
          <ThemedText themeColor="textSecondary">
            Kto pyta, o co zapyta, co odpowiedzieć i gdzie jest pułapka. Materiał do
            przeczytania w kilkanaście minut przed wejściem do studia.
          </ThemedText>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nowy brief"
          onPress={() => router.push('/brief/new')}
          style={({ pressed }) => [
            styles.newCard,
            {
              borderColor: theme.accent,
              backgroundColor: pressed ? theme.backgroundSelected : 'transparent',
            },
          ]}>
          <Ionicons name="add" size={20} color={theme.accent} />
          <ThemedText themeColor="accent" style={styles.newLabel}>
            Nowy brief
          </ThemedText>
        </Pressable>

        {error ? (
          <View style={[styles.alert, { borderLeftColor: theme.error }]}>
            <ThemedText type="small">{error}</ThemedText>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : briefs.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Nie ma jeszcze żadnego briefu. Zamów pierwszy przed najbliższym wywiadem.
          </ThemedText>
        ) : (
          briefs.map((b) => (
            <Pressable
              key={b.id}
              accessibilityRole="button"
              accessibilityLabel={`Otwórz brief: ${b.topic}`}
              onPress={() => router.push(`/brief/${b.id}`)}>
              <ThemedView
                type="backgroundElement"
                style={[styles.card, { borderColor: theme.border }]}>
                <View style={styles.cardHeader}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {statusLabel(b)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatLongDate(b.created_at)}
                  </ThemedText>
                </View>
                <ThemedText style={styles.cardTitle}>{b.topic}</ThemedText>
                {b.journalists ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {b.journalists.full_name}
                    {b.journalists.outlets ? `, ${b.journalists.outlets.name}` : ''}
                  </ThemedText>
                ) : null}
                {b.rating ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Ocena: {b.rating} z 5
                  </ThemedText>
                ) : null}
              </ThemedView>
            </Pressable>
          ))
        )}
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
    gap: Spacing.three,
  },
  iconButton: { padding: Spacing.one, alignSelf: 'flex-start' },
  header: { gap: Spacing.two },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.screenTitle,
    lineHeight: FontSize.screenTitle * 1.25,
  },
  newCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.card,
    paddingVertical: Spacing.three,
  },
  newLabel: { fontFamily: FontFamily.sansSemiBold },
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cardTitle: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.section,
    lineHeight: FontSize.section * 1.3,
  },
  alert: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.three,
    paddingVertical: Spacing.two,
  },
  centered: { paddingVertical: Spacing.six, alignItems: 'center' },
});
