import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { track } from '@/lib/analytics/posthog';
import { searchTargets, type TargetMp } from '@/lib/api/analysis';
import { createBrief, type BriefParticipant } from '@/lib/api/brief';
import {
  getProgram,
  listJournalists,
  listPrograms,
  type JournalistListItem,
  type ProgramEpisode,
  type ProgramListItem,
} from '@/lib/api/media';
import { formatDate } from '@/lib/format';

/** Ile ostatnich odcinków pokazujemy pod wybranym programem. */
const EPISODES_PREVIEW = 3;

/**
 * Formularz „gdzie, kto prowadzi, kto jeszcze, temat".
 *
 * Trzy pierwsze pola ciągną dane, zamiast wymagać, żeby człowiek chodził po
 * innych ekranach. Wcześniej przygotowanie do rozmowy wymagało trzech ekranów
 * i pamiętania, żeby nie kliknąć niewłaściwej osoby: w bazie dziennikarzy jest
 * Magdalena Olejnik, a Kropkę nad i prowadzi Monika, więc wybór z listy budował
 * profil zupełnie innej osoby i nic nie ostrzegało. Wybór programu wypełnia
 * prowadzącego z tabeli `programs` i tę pułapkę usuwa.
 */
export default function NewBriefScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // Temat moze przyjsc z karty na Pulpicie; `from` sluzy tylko analityce.
  const params = useLocalSearchParams<{ topic?: string; from?: string }>();

  const [topic, setTopic] = useState(params.topic ?? '');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gdzie
  const [programs, setPrograms] = useState<ProgramListItem[]>([]);
  const [program, setProgram] = useState<ProgramListItem | null>(null);
  const [episodes, setEpisodes] = useState<ProgramEpisode[]>([]);

  // Kto prowadzi
  const [query, setQuery] = useState('');
  const [manualName, setManualName] = useState('');
  const [selected, setSelected] = useState<JournalistListItem | null>(null);
  const [journalists, setJournalists] = useState<JournalistListItem[]>([]);

  // Kto jeszcze
  const [guestQuery, setGuestQuery] = useState('');
  const [guestResults, setGuestResults] = useState<TargetMp[]>([]);
  const [participants, setParticipants] = useState<BriefParticipant[]>([]);

  useEffect(() => {
    let active = true;
    listJournalists()
      .then((rows) => {
        if (active) setJournalists(rows);
      })
      .catch(() => undefined);
    listPrograms()
      .then((rows) => {
        if (active) setPrograms(rows);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  /**
   * Szukajka posłów chodzi do API Sejmu, więc dopiero po zatrzymaniu pisania.
   * Czyszczenie wyników siedzi w obsłudze wpisywania, nie tutaj: setState
   * wprost w efekcie wywołuje kaskadę renderów (reguła react-hooks).
   */
  useEffect(() => {
    const phrase = guestQuery.trim();
    if (phrase.length < 3) return;
    let active = true;
    const id = setTimeout(() => {
      searchTargets(phrase)
        .then((result) => {
          if (active) setGuestResults(result.mps.slice(0, 6));
        })
        .catch(() => undefined);
    }, 400);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [guestQuery]);

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

  const pickProgram = useCallback(async (item: ProgramListItem) => {
    setProgram(item);
    setEpisodes([]);
    try {
      const data = await getProgram(item.slug);
      setEpisodes(data.episodes.slice(0, EPISODES_PREVIEW));
    } catch {
      // Podgląd odcinków jest wzbogaceniem, brak nie blokuje briefu.
    }
  }, []);

  const addGuest = useCallback((mp: TargetMp) => {
    setParticipants((current) =>
      current.some((p) => p.mp_id === mp.mp_id)
        ? current
        : [...current, { role: 'opponent', kind: 'mp', mp_id: mp.mp_id, name: mp.full_name, club: mp.club }]
    );
    setGuestQuery('');
    setGuestResults([]);
  }, []);

  /** Prowadzący pokazywany pod polem: z bazy, z ręki albo z programu. */
  const hostLabel =
    selected?.full_name ??
    (manualName.trim() || null) ??
    (program?.hosts.length ? program.hosts[0] : null);

  const handleCreate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await createBrief({
        topic: topic.trim(),
        ...(program ? { program_slug: program.slug } : {}),
        ...(selected ? { journalist_id: selected.id } : {}),
        ...(!selected && manualName.trim() ? { journalist_name: manualName.trim() } : {}),
        ...(participants.length > 0 ? { participants } : {}),
      });
      // North star produktu to liczba briefow tygodniowo per tenant, wiec to
      // jest najwazniejsze zdarzenie w calej aplikacji. `zrodlo` rozroznia
      // wejscie z Pulpitu od drogi przez zakladke Analizy.
      track('brief_created', {
        z_dziennikarzem: Boolean(hostLabel),
        z_bazy: Boolean(selected),
        z_programem: Boolean(program),
        oponentow: participants.length,
        zrodlo: params.from === 'pulpit' ? 'pulpit' : 'analizy',
      });
      router.replace(`/brief/${result.brief.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się przygotować briefu.');
      setGenerating(false);
    }
  }, [hostLabel, manualName, params.from, participants, program, router, selected, topic]);

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
            Powiedz, gdzie i z kim rozmawiasz. Argus dobierze prowadzącego, ostatnie tematy
            tego programu, dane o osobie naprzeciwko i Twoje wcześniejsze wypowiedzi.
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

          {/* Gdzie */}
          <View style={styles.section}>
            <ThemedText type="small" themeColor="textSecondary" style={KickerStyle}>
              GDZIE
            </ThemedText>
            {program ? (
              <>
                <View style={styles.selectedRow}>
                  <ThemedText>
                    {program.name}
                    {program.outlet_name ? `, ${program.outlet_name}` : ''}
                  </ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Zmień program"
                    onPress={() => {
                      setProgram(null);
                      setEpisodes([]);
                    }}>
                    <ThemedText type="small" themeColor="accentLight">
                      Zmień
                    </ThemedText>
                  </Pressable>
                </View>
                {program.schedule_note ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {program.schedule_note}
                  </ThemedText>
                ) : null}
                {episodes.length > 0 ? (
                  <View style={styles.episodes}>
                    <ThemedText type="small" themeColor="accentLight">
                      Ostatnie tematy w tym programie
                    </ThemedText>
                    {episodes.map((episode) => (
                      <ThemedText key={episode.id} type="small" themeColor="textSecondary">
                        {episode.published_at ? `${formatDate(episode.published_at)}: ` : ''}
                        {episode.guests.length > 0 ? `${episode.guests.join(', ')}, ` : ''}
                        {episode.title}
                      </ThemedText>
                    ))}
                  </View>
                ) : null}
              </>
            ) : (
              <>
                {programs.map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Wybierz program: ${item.name}`}
                    onPress={() => void pickProgram(item)}
                    style={[styles.result, { borderColor: theme.border }]}>
                    <ThemedText type="small">{item.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {[item.outlet_name, item.hosts.join(', ') || null].filter(Boolean).join(' · ')}
                    </ThemedText>
                  </Pressable>
                ))}
                <ThemedText type="small" themeColor="textSecondary">
                  Program jest opcjonalny. Bez niego prowadzącego trzeba wskazać samodzielnie.
                </ThemedText>
              </>
            )}
          </View>

          {/* Kto prowadzi */}
          <View style={styles.section}>
            <ThemedText type="small" themeColor="textSecondary" style={KickerStyle}>
              KTO PROWADZI
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
                {program?.hosts.length && !manualName.trim() ? (
                  <ThemedText type="small">
                    {program.hosts.join(', ')}, z danych programu. Poniżej możesz wskazać kogoś
                    innego, gdy jest zastępstwo.
                  </ThemedText>
                ) : null}
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

          {/* Kto jeszcze */}
          <View style={styles.section}>
            <ThemedText type="small" themeColor="textSecondary" style={KickerStyle}>
              KTO JESZCZE
            </ThemedText>

            {participants.map((person) => (
              <View key={`${person.mp_id ?? person.name}`} style={styles.selectedRow}>
                <ThemedText>
                  {person.name}
                  {person.club ? `, ${person.club}` : ''}
                </ThemedText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Usuń: ${person.name}`}
                  onPress={() =>
                    setParticipants((current) => current.filter((p) => p !== person))
                  }>
                  <ThemedText type="small" themeColor="accentLight">
                    Usuń
                  </ThemedText>
                </Pressable>
              </View>
            ))}

            <FormTextInput
              label="Drugi gość albo oponent (opcjonalnie)"
              value={guestQuery}
              onChangeText={(value) => {
                setGuestQuery(value);
                if (value.trim().length < 3) setGuestResults([]);
              }}
              placeholder="Nazwisko posła"
              autoCapitalize="none"
              editable={!generating}
            />
            {guestResults.map((mp) => (
              <Pressable
                key={mp.mp_id}
                accessibilityRole="button"
                accessibilityLabel={`Dodaj: ${mp.full_name}`}
                onPress={() => addGuest(mp)}
                style={[styles.result, { borderColor: theme.border }]}>
                <ThemedText type="small">{mp.full_name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {mp.club}
                </ThemedText>
              </Pressable>
            ))}
            <ThemedText type="small" themeColor="textSecondary">
              Dla posła Argus dociągnie jego głosowania, rozjazdy z klubem i wystąpienia,
              razem z listą tego, czego o nim nie wiemy.
            </ThemedText>
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
  episodes: { gap: Spacing.one, paddingTop: Spacing.one },
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
