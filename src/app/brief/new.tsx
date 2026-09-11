import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormTextInput } from '@/components/form-text-input';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, FontSize, KickerStyle, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { track } from '@/lib/analytics/posthog';
import { createBrief } from '@/lib/api/brief';
import { listJournalists, type JournalistListItem } from '@/lib/api/media';

/**
 * Formularz „gdzie, kto, temat".
 *
 * Dziennikarza można wybrać z bazy albo wpisać z ręki: baza ma pięć redakcji,
 * a wywiad bywa z kimś spoza niej. Schemat to unosi (`journalist_id` jest
 * nullowalne), a prompt dostaje wtedy wprost informację, że profilu nie ma,
 * zamiast zmyślać styl prowadzenia.
 */
export default function NewBriefScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [topic, setTopic] = useState('');
  const [query, setQuery] = useState('');
  const [manualName, setManualName] = useState('');
  const [selected, setSelected] = useState<JournalistListItem | null>(null);
  const [journalists, setJournalists] = useState<JournalistListItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listJournalists()
      .then((rows) => {
        if (active) setJournalists(rows);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return journalists
      .filter(
        (j) =>
          j.full_name.toLowerCase().includes(q) ||
          (j.outlet_name ?? '').toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [journalists, query]);

  const handleCreate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await createBrief({
        topic: topic.trim(),
        ...(selected ? { journalist_id: selected.id } : {}),
        ...(!selected && manualName.trim() ? { journalist_name: manualName.trim() } : {}),
      });
      // North star produktu to liczba briefow tygodniowo per tenant, wiec to
      // jest najwazniejsze zdarzenie w calej aplikacji. `zrodlo` rozroznia
      // wejscie z Pulpitu od drogi przez zakladke Analizy.
      track('brief_created', {
        z_dziennikarzem: Boolean(selected) || manualName.trim().length > 0,
        z_bazy: Boolean(selected),
      });
      router.replace(`/brief/${result.brief.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się przygotować briefu.');
      setGenerating(false);
    }
  }, [manualName, router, selected, topic]);

  const canSubmit = topic.trim().length >= 5 && !generating;

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.six },
        ]}
        keyboardShouldPersistTaps="handled">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Wróć"
          onPress={() => router.back()}
          style={styles.iconButton}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>

        <View style={styles.header}>
          <ThemedText style={styles.title}>Nowy brief</ThemedText>
          <ThemedText themeColor="textSecondary">
            Podaj temat rozmowy i osobę, która ją poprowadzi. Argus zbierze profil
            rozmówcy, Twoje wcześniejsze wypowiedzi i dzisiejszy przegląd dnia.
          </ThemedText>
        </View>

        <ThemedView type="backgroundElement" style={[styles.form, { borderColor: theme.border }]}>
          <FormTextInput
            label="Temat rozmowy"
            value={topic}
            onChangeText={setTopic}
            placeholder="Na przykład deficyt budżetowy na 2027 rok"
            editable={!generating}
          />

          <View style={styles.section}>
            <ThemedText type="small" themeColor="textSecondary" style={KickerStyle}>
              DZIENNIKARZ
            </ThemedText>

            {selected ? (
              <View style={styles.selectedRow}>
                <ThemedText>
                  {selected.full_name}
                  {selected.outlet_name ? `, ${selected.outlet_name}` : ''}
                </ThemedText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Zmień dziennikarza"
                  onPress={() => setSelected(null)}>
                  <ThemedText type="small" themeColor="accentLight">
                    Zmień
                  </ThemedText>
                </Pressable>
              </View>
            ) : (
              <>
                <FormTextInput
                  label="Szukaj w bazie"
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Wpisz co najmniej dwa znaki"
                  autoCapitalize="none"
                  editable={!generating}
                />
                {results.map((j) => (
                  <Pressable
                    key={j.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Wybierz: ${j.full_name}`}
                    onPress={() => {
                      setSelected(j);
                      setQuery('');
                    }}
                    style={[styles.result, { borderColor: theme.border }]}>
                    <ThemedText type="small">{j.full_name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {j.outlet_name ?? 'redakcja nieznana'}
                      {j.role ? ` · ${j.role}` : ''}
                    </ThemedText>
                  </Pressable>
                ))}

                <FormTextInput
                  label="Albo wpisz nazwisko spoza bazy (opcjonalnie)"
                  value={manualName}
                  onChangeText={setManualName}
                  placeholder="Imię i nazwisko"
                  editable={!generating}
                />
                <ThemedText type="small" themeColor="textSecondary">
                  Bez profilu w bazie Argus napisze wprost, czego o rozmówcy nie wiadomo,
                  zamiast zgadywać jego styl prowadzenia.
                </ThemedText>
              </>
            )}
          </View>

          {error ? (
            <View style={[styles.alert, { borderLeftColor: theme.error }]}>
              <ThemedText type="small">{error}</ThemedText>
            </View>
          ) : null}

          <PrimaryButton
            title={generating ? 'Przygotowuję brief...' : 'Przygotuj brief'}
            onPress={handleCreate}
            disabled={!canSubmit}
            loading={generating}
          />
          {generating ? (
            <View style={styles.centered}>
              <ActivityIndicator color={theme.accent} />
              <ThemedText type="small" themeColor="textSecondary">
                Zbieram materiały i piszę brief. To potrwa około dwóch minut.
              </ThemedText>
            </View>
          ) : null}
        </ThemedView>
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
  form: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  section: { gap: Spacing.two },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  result: {
    borderWidth: 1,
    borderRadius: Radius.small,
    padding: Spacing.two,
    gap: 2,
  },
  alert: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.three,
    paddingVertical: Spacing.two,
  },
  centered: { alignItems: 'center', gap: Spacing.two },
});
