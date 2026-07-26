import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormTextInput } from '@/components/form-text-input';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, FontSize, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { track } from '@/lib/analytics/posthog';
import {
  addTopic,
  listTopics,
  removeTopic,
  updateTopic,
  type WatchedTopic,
} from '@/lib/api/mentions';
import { relativeTime } from '@/lib/format-time';

/** Potwierdzenie usunięcia. Na webie `Alert` nie działa, więc `confirm`. */
async function confirmRemoval(phrase: string): Promise<boolean> {
  const message = `Usunąć hasło „${phrase}”? Zebrane wzmianki też znikną.`;

  if (Platform.OS === 'web') {
    return globalThis.confirm(message);
  }

  return new Promise((resolve) => {
    Alert.alert('Usunięcie hasła', message, [
      { text: 'Anuluj', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Usuń', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

/**
 * Hasła obserwowane: nazwiska, nazwy partii, tematy. Na ich podstawie Argus
 * pobiera wzmianki z Bing News RSS do briefu porannego.
 *
 * Hasła są wspólne dla całego biura: polityk i asystent widzą tę samą listę.
 */
export default function WatchedTermsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [topics, setTopics] = useState<WatchedTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [phrase, setPhrase] = useState('');
  const [query, setQuery] = useState('');
  const [advanced, setAdvanced] = useState(false);

  /** Odświeżenie listy po zmianie. Wołane wyłącznie z akcji użytkownika. */
  const reload = useCallback(async () => {
    const result = await listTopics();
    setTopics(result.topics);
    setError(null);
  }, []);

  useEffect(() => {
    let active = true;

    listTopics()
      .then((result) => {
        if (!active) return;
        setTopics(result.topics);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Nie udało się pobrać haseł.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleAdd = useCallback(async () => {
    const trimmed = phrase.trim();
    if (trimmed.length < 2) {
      setError('Hasło musi mieć co najmniej dwa znaki.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await addTopic({
        phrase: trimmed,
        query: query.trim() || undefined,
      });
      track('watch_term_added', { fetched: result.sync?.fetched ?? 0 });
      setPhrase('');
      setQuery('');
      setAdvanced(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się dodać hasła.');
    } finally {
      setSaving(false);
    }
  }, [reload, phrase, query]);

  const handleToggle = useCallback(async (topic: WatchedTopic) => {
    // Optymistycznie: przełącznik ma reagować natychmiast.
    setTopics((current) =>
      current.map((item) =>
        item.id === topic.id ? { ...item, active: !item.active } : item,
      ),
    );
    try {
      await updateTopic({ topic_id: topic.id, active: !topic.active });
    } catch (err) {
      setTopics((current) =>
        current.map((item) => (item.id === topic.id ? { ...item, active: topic.active } : item)),
      );
      setError(err instanceof Error ? err.message : 'Nie udało się zmienić hasła.');
    }
  }, []);

  const handleRemove = useCallback(
    async (topic: WatchedTopic) => {
      if (!(await confirmRemoval(topic.phrase))) return;

      try {
        await removeTopic(topic.id);
        track('watch_term_removed');
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Nie udało się usunąć hasła.');
      }
    },
    [reload],
  );

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.six },
        ]}
        keyboardShouldPersistTaps="handled"
        // Klawiatura nie moze zaslaniac przycisku pod formularzem. Na iOS robi to
        // ta wlasciwosc (ScrollView sam koryguje wciecie), na Androidzie domyslny
        // tryb okna "resize" z Expo.
        automaticallyAdjustKeyboardInsets>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Wróć"
          onPress={() => router.back()}
          style={styles.iconButton}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>

        <View style={styles.header}>
          <ThemedText style={styles.title}>Hasła</ThemedText>
          <ThemedText themeColor="textSecondary">
            Nazwiska, nazwy partii i tematy, których Argus pilnuje w prasie. Hasła są wspólne dla
            całego biura.
          </ThemedText>
        </View>

        {error ? (
          <View style={[styles.alert, { borderLeftColor: theme.error }]}>
            <ThemedText type="small">{error}</ThemedText>
          </View>
        ) : null}

        <ThemedView
          type="backgroundElement"
          style={[styles.form, { borderColor: theme.border }]}>
          <FormTextInput
            label="Nowe hasło"
            value={phrase}
            onChangeText={setPhrase}
            placeholder="Na przykład: Ryszard Petru"
            autoCapitalize="words"
            editable={!saving}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />

          {advanced ? (
            <FormTextInput
              label="Zapytanie do wyszukiwarki (opcjonalnie)"
              value={query}
              onChangeText={setQuery}
              placeholder={'"Ryszard Petru" OR "Petru"'}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!saving}
            />
          ) : null}

          <Pressable accessibilityRole="button" onPress={() => setAdvanced((value) => !value)}>
            <ThemedText type="small" themeColor="accentLight">
              {advanced ? 'Ukryj zapytanie zaawansowane' : 'Ustaw własne zapytanie'}
            </ThemedText>
          </Pressable>

          <ThemedText type="small" themeColor="textSecondary">
            Polskie nazwiska się odmieniają, więc dla nazwiska warto podać własne zapytanie z
            wariantami, na przykład: {'"Pieniak" OR "Pieniaka" OR "Pieniakowi"'}. Działają
            operatory wyszukiwarki: cudzysłów, OR, site:.
          </ThemedText>

          <PrimaryButton title="Dodaj hasło" onPress={handleAdd} loading={saving} />
        </ThemedView>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : topics.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Nie ma jeszcze żadnych haseł.
          </ThemedText>
        ) : (
          topics.map((topic) => (
            <ThemedView
              key={topic.id}
              type="backgroundElement"
              style={[styles.card, { borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <ThemedText style={styles.cardTitle}>{topic.phrase}</ThemedText>
                <Switch
                  value={topic.active}
                  onValueChange={() => handleToggle(topic)}
                  accessibilityLabel={`Hasło ${topic.phrase}: ${topic.active ? 'aktywne' : 'wyłączone'}`}
                  trackColor={{ false: theme.progressTrack, true: theme.accent }}
                  thumbColor={theme.text}
                />
              </View>

              {topic.query ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Zapytanie: {topic.query}
                </ThemedText>
              ) : null}

              <ThemedText type="small" themeColor="textSecondary">
                {topic.last_synced_at
                  ? `Ostatnie pobranie: ${relativeTime(topic.last_synced_at)}`
                  : 'Jeszcze nie pobierano'}
                {topic.unread_count > 0 ? ` · nowych: ${topic.unread_count}` : ''}
              </ThemedText>

              {topic.last_sync_error ? (
                <View style={[styles.alert, { borderLeftColor: theme.error }]}>
                  <ThemedText type="small">{topic.last_sync_error}</ThemedText>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Usuń hasło ${topic.phrase}`}
                onPress={() => handleRemove(topic)}>
                <ThemedText type="small" themeColor="error">
                  Usuń hasło
                </ThemedText>
              </Pressable>
            </ThemedView>
          ))
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
  form: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.three,
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
  cardTitle: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.section,
    lineHeight: FontSize.section * 1.3,
    flexShrink: 1,
  },
  alert: {
    borderLeftWidth: 2,
    borderRadius: Radius.small,
    padding: Spacing.three,
  },
  centered: {
    alignItems: 'center',
    paddingVertical: Spacing.five,
  },
});
