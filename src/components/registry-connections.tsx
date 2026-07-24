/**
 * Panel powiązań z Krajowym Rejestrem Sądowym.
 *
 * Przepływ jest celowo trzystopniowy: szukaj, POTWIERDŹ, dopiero potem
 * powiązania. Wyszukiwanie po imieniu i nazwisku zwraca imienników, a rejestr
 * nie daje pola, którym można ich rozróżnić. Przypisanie cudzych spółek
 * politykowi byłoby zniesławieniem, więc wybór należy do człowieka.
 *
 * Kontrakt: docs/kontrakt-rejestr-krs.md
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { FormTextInput } from '@/components/form-text-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getConnections,
  linkPerson,
  listSubjects,
  type PersonCandidate,
  refreshConnections,
  type RegistryConnection,
  type RegistrySubject,
  searchPerson,
  unlinkSubject,
} from '@/lib/api/registry';

type Props = {
  /** Domyślna fraza wyszukiwania, np. imię i nazwisko polityka z profilu. */
  defaultQuery?: string;
  /** Id profilu polityka, do którego przypinamy tożsamość. */
  subjectId?: string | null;
};

function formatDate(value: string | null): string {
  if (!value) return 'brak danych';
  return value.split('-').reverse().join('.');
}

export function RegistryConnections({ defaultQuery = '', subjectId = null }: Props) {
  const theme = useTheme();
  const [query, setQuery] = useState(defaultQuery);
  const [candidates, setCandidates] = useState<PersonCandidate[] | null>(null);
  const [ambiguous, setAmbiguous] = useState(false);
  const [subject, setSubject] = useState<RegistrySubject | null>(null);
  const [connections, setConnections] = useState<RegistryConnection[]>([]);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConnections = useCallback(async (id: string) => {
    const result = await getConnections(id);
    setConnections(result.connections);
    setSyncedAt(result.synced_at);
  }, []);

  // Przy wejściu sprawdzamy, czy tożsamość jest już potwierdzona.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { subjects } = await listSubjects();
        const existing = subjects.find(
          (s) => s.subject_type === 'politician' && s.match_status === 'confirmed',
        );
        if (cancelled) return;
        setSubject(existing ?? null);
        if (existing) await loadConnections(existing.id);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadConnections]);

  const handleSearch = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await searchPerson(query);
      setCandidates(result.candidates);
      setAmbiguous(result.ambiguous);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async (candidate: PersonCandidate) => {
    setError(null);
    setBusy(true);
    try {
      const result = await linkPerson({
        person_id: candidate.person_id,
        subject_type: 'politician',
        subject_id: subjectId,
        label: candidate.full_name,
      });
      setSubject(result.subject);
      setCandidates(null);
      await loadConnections(result.subject.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRefresh = async () => {
    if (!subject) return;
    setError(null);
    setBusy(true);
    try {
      const result = await refreshConnections(subject.id);
      setConnections(result.connections);
      setSyncedAt(result.synced_at);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleUnlink = async () => {
    if (!subject) return;
    setError(null);
    setBusy(true);
    try {
      await unlinkSubject(subject.id);
      setSubject(null);
      setConnections([]);
      setSyncedAt(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
      <ThemedText style={styles.title}>Powiązania z rejestrem sądowym</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Spółki, fundacje i stowarzyszenia, w których figurujesz w KRS. Dziennikarz sprawdzi to
        przed wywiadem, więc lepiej, żebyś wiedział_a o tym wcześniej.
      </ThemedText>

      {loading ? <ThemedText type="small">Wczytywanie.</ThemedText> : null}

      {error ? (
        <ThemedText type="small" themeColor="error">
          {error}
        </ThemedText>
      ) : null}

      {!loading && !subject ? (
        <View style={styles.section}>
          <FormTextInput
            label="Imię i nazwisko"
            value={query}
            onChangeText={setQuery}
            placeholder="Jan Kowalski"
            autoCapitalize="words"
          />
          <PrimaryButton
            title="Szukaj w KRS"
            onPress={handleSearch}
            loading={busy}
            disabled={query.trim().split(/\s+/).length < 2}
          />
        </View>
      ) : null}

      {candidates && candidates.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Rejestr nie zna osoby o tym imieniu i nazwisku. To znaczy, że nie figurujesz w żadnej
          spółce ani fundacji wpisanej do KRS.
        </ThemedText>
      ) : null}

      {candidates && candidates.length > 0 ? (
        <View style={styles.section}>
          {ambiguous ? (
            <View style={[styles.warning, { borderLeftColor: theme.error }]}>
              <ThemedText type="small">
                Rejestr zwrócił kilka osób o tym samym imieniu i nazwisku i nie udostępnia danych,
                którymi można je rozróżnić. Wybierz właściwą osobę na podstawie listy spółek.
                Błędny wybór przypisze Ci cudze powiązania.
              </ThemedText>
            </View>
          ) : null}

          {candidates.map((candidate) => (
            <Pressable
              key={candidate.person_id}
              onPress={() => handleConfirm(candidate)}
              disabled={busy}
              style={[styles.row, { borderColor: theme.border }]}>
              <ThemedText style={styles.rowTitle}>
                {candidate.full_name}
                {candidate.middle_names ? ` (${candidate.middle_names})` : ''}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Powiązania aktualne: {candidate.connections_current}, historyczne:{' '}
                {candidate.connections_past}
              </ThemedText>
              {candidate.organizations_preview.length > 0 ? (
                <ThemedText type="small" themeColor="teal">
                  {candidate.organizations_preview.join(', ')}
                </ThemedText>
              ) : null}
              <ThemedText type="small" themeColor="accentLight">
                To ja, potwierdzam
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}

      {subject ? (
        <View style={styles.section}>
          <ThemedText type="small" themeColor="textSecondary">
            Potwierdzona tożsamość: {subject.label}. Dane z dnia {formatDate(syncedAt?.slice(0, 10) ?? null)}.
          </ThemedText>

          {connections.length === 0 ? (
            <ThemedText type="small">
              Brak aktualnych powiązań kapitałowych w KRS.
            </ThemedText>
          ) : (
            connections.map((connection) => (
              <View
                key={`${connection.org_krs}-${connection.role_type}`}
                style={[styles.row, { borderColor: theme.border }]}>
                <ThemedText style={styles.rowTitle}>{connection.name}</ThemedText>
                <ThemedText type="small" themeColor="accentLight">
                  {connection.role_label}, od {formatDate(connection.date_start)}
                </ThemedText>
                {connection.branch ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Branża: {connection.branch}
                  </ThemedText>
                ) : null}
                <ThemedText type="small" themeColor="textSecondary">
                  KRS {connection.org_krs}
                </ThemedText>
              </View>
            ))
          )}

          <PrimaryButton
            title="Odśwież dane z rejestru"
            variant="secondary"
            onPress={handleRefresh}
            loading={busy}
          />
          <Pressable onPress={handleUnlink} disabled={busy}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.unlink}>
              Odepnij tożsamość z rejestru
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  title: {
    fontFamily: FontFamily.sansSemiBold,
  },
  section: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  row: {
    borderWidth: 1,
    borderRadius: Radius.small,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  rowTitle: {
    fontFamily: FontFamily.sansSemiBold,
  },
  warning: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.three,
    paddingVertical: Spacing.two,
  },
  unlink: {
    textDecorationLine: 'underline',
  },
});
