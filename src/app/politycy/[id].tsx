import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackLink } from '@/components/back-link';
import { EyeDot } from '@/components/eye-dot';
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
import {
  collectClubVotes,
  getDossier,
  type Dossier,
  type ProbeFinding,
  type ProbeResult,
} from '@/lib/api/analysis';
import { formatDate, polishPlural } from '@/lib/format';

/** Okno analizy w miesiącach. Pół roku to kompromis między zasięgiem a czasem zbierania. */
const MONTHS = 6;

function probe(dossier: Dossier | null, id: string): ProbeResult | null {
  return dossier?.results.find((r) => r.probe === id) ?? null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/**
 * Karta posła: wynik zestawu sond „karta-posla" z jednego wywołania.
 *
 * Kolejność sekcji nie jest przypadkowa. Karta zaczyna się od dyscypliny
 * klubowej Z MIANOWNIKIEM, a nie od listy rozjazdów, bo dla większości posłów
 * ta lista będzie krótka albo pusta, a pusta lista wygląda jak awaria.
 * „1 rozjazd na 853 głosowania" mówi coś zarówno przy jedynce, jak i przy
 * pięćdziesiątce; sama jedynka nie mówi nic.
 */
export default function PoliticianScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mpId = Number(id);

  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collecting, setCollecting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(mpId)) return;
    try {
      const data = await getDossier(mpId, MONTHS);
      setDossier(data);
      setError(null);
      track('politician_dossier_viewed', {
        mp_id: mpId,
        ustalen: data.results.reduce((sum, r) => sum + r.findings.length, 0),
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Nie udało się wczytać karty.');
    } finally {
      setLoaded(true);
    }
  }, [mpId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleCollect = useCallback(async () => {
    setCollecting('Zbieram głosy klubu...');
    try {
      await collectClubVotes(mpId, MONTHS, (step) => {
        setCollecting(`Zbieram głosy klubu: ${step.member_index + 1} z ${step.members}`);
      });
      setCollecting('Liczę rozjazdy...');
      await load();
    } catch (collectError) {
      setError(
        collectError instanceof Error ? collectError.message : 'Nie udało się zebrać głosów klubu.'
      );
    } finally {
      setCollecting(null);
    }
  }, [mpId, load]);

  const identity = probe(dossier, 'sejm.identity');
  const divergence = probe(dossier, 'club.divergence');
  const statements = probe(dossier, 'sejm.statements');
  const appearances = probe(dossier, 'program.appearances');

  const fullName = text(identity?.summary.full_name) ?? dossier?.subject.name ?? 'Poseł';
  const comparable = num(divergence?.summary.comparable);
  const divergences = num(divergence?.summary.divergences);
  const cases = num(divergence?.summary.cases);
  const attendanceShare = num(divergence?.summary.attendance_share);
  const needsCollect = divergence !== null && comparable === null;

  const severityColor = (severity: number) =>
    severity === 3 ? theme.error : severity === 2 ? theme.accent : theme.textSecondary;

  const renderFinding = (finding: ProbeFinding, index: number) => (
    <View
      key={`${finding.probe}-${index}`}
      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.severityDot, { backgroundColor: severityColor(finding.severity) }]} />
        <ThemedText style={styles.cardTitle}>{finding.title}</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {finding.description}
      </ThemedText>
      {finding.evidence.slice(0, 3).map((evidence, i) => (
        <View key={i} style={[styles.evidence, { borderLeftColor: theme.accent }]}>
          {evidence.quote ? (
            <ThemedText type="small" style={styles.quote} numberOfLines={5}>
              {evidence.quote}
            </ThemedText>
          ) : null}
          <View style={styles.evidenceMeta}>
            <ThemedText type="small" themeColor="textSecondary">
              {evidence.date ? formatDate(evidence.date) : 'bez daty'}
            </ThemedText>
            {evidence.url ? (
              <Pressable onPress={() => void Linking.openURL(evidence.url as string)}>
                <ThemedText type="small" themeColor="accentLight">
                  Otwórz źródło
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );

  const allGaps = (dossier?.results ?? []).flatMap((r) =>
    r.coverage.gaps.map((gap) => ({ label: r.label, gap }))
  );

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four },
        ]}>
        <BackLink />

        {!loaded ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : null}

        {loaded && error ? (
          <View style={styles.errorBox}>
            <ThemedText type="small" themeColor="error" style={styles.centered}>
              {error}
            </ThemedText>
            <PrimaryButton
              title="Spróbuj ponownie"
              variant="secondary"
              onPress={() => {
                setLoaded(false);
                setError(null);
                void load();
              }}
            />
          </View>
        ) : null}

        {dossier ? (
          <>
            <View style={styles.header}>
              <ThemedText style={styles.title}>{fullName}</ThemedText>
              <ThemedText themeColor="textSecondary">
                {[
                  text(identity?.summary.club),
                  text(identity?.summary.district)
                    ? `okręg ${text(identity?.summary.district)}`
                    : null,
                  text(identity?.summary.profession),
                ]
                  .filter(Boolean)
                  .join(', ') || 'Poseł na Sejm'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Dane z okresu {formatDate(dossier.window.from)} do {formatDate(dossier.window.to)}.
              </ThemedText>
            </View>

            {/* Dyscyplina klubowa: liczba zawsze z mianownikiem. */}
            <View
              style={[
                styles.headline,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}>
              <ThemedText themeColor="accentLight" style={styles.kicker}>
                Dyscyplina klubowa
              </ThemedText>
              {needsCollect ? (
                <>
                  <ThemedText type="small" themeColor="textSecondary">
                    Głosy klubu nie są jeszcze zebrane, więc porównania nie ma. Pierwsze zbieranie
                    dla klubu trwa kilka minut, kolejne karty posłów z tego klubu są już szybkie.
                  </ThemedText>
                  <PrimaryButton
                    title={collecting ?? 'Zbierz głosy klubu'}
                    variant="secondary"
                    disabled={collecting !== null}
                    onPress={() => void handleCollect()}
                  />
                </>
              ) : (
                <>
                  <View style={styles.bigNumberRow}>
                    <ThemedText style={[styles.bigNumber, { color: theme.accent }]}>
                      {divergences ?? 0}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.bigNumberNote}>
                      {polishPlural(divergences ?? 0, 'rozjazd', 'rozjazdy', 'rozjazdów')} ze
                      stanowiskiem klubu na {comparable ?? 0} porównywalnych głosowań
                      {cases !== null && cases > 0
                        ? `, w ${polishPlural(cases, 'sprawie', 'sprawach', 'sprawach')}`
                        : ''}
                      .
                    </ThemedText>
                  </View>
                  {attendanceShare !== null ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      Obecność przy głosowaniach: {Math.round(attendanceShare * 1000) / 10}%.
                    </ThemedText>
                  ) : null}
                  <ThemedText type="small" themeColor="textSecondary">
                    Punktem odniesienia jest stanowisko większości klubu, nie jego lider.
                  </ThemedText>
                </>
              )}
            </View>

            {divergence && divergence.findings.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <EyeDot size={8} />
                  <ThemedText themeColor="accentLight" style={styles.kicker}>
                    Gdzie się rozjechał
                  </ThemedText>
                </View>
                {divergence.findings.map(renderFinding)}
              </View>
            ) : null}

            {statements ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <EyeDot size={8} />
                  <ThemedText themeColor="accentLight" style={styles.kicker}>
                    Co mówił z mównicy
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {statements.findings.length}
                  </ThemedText>
                </View>
                {statements.findings.length > 0 ? (
                  statements.findings.map(renderFinding)
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">
                    {statements.summary.imported === true
                      ? 'W tym okresie nie zabierał głosu na sali. To fakt o pośle, nie brak danych.'
                      : 'Wystąpienia tego posła nie są jeszcze zaimportowane, więc nie wiemy, czy zabierał głos.'}
                  </ThemedText>
                )}
              </View>
            ) : null}

            {appearances && appearances.findings.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <EyeDot size={8} />
                  <ThemedText themeColor="accentLight" style={styles.kicker}>
                    Wejścia do programów
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {appearances.findings.length}
                  </ThemedText>
                </View>
                {appearances.findings.map(renderFinding)}
              </View>
            ) : null}

            {/* Luki pokazujemy wprost. Bez tego brak sekcji wygląda jak brak problemu. */}
            {allGaps.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <EyeDot size={8} />
                  <ThemedText themeColor="accentLight" style={styles.kicker}>
                    Czego nie wiemy
                  </ThemedText>
                </View>
                {allGaps.map((item, index) => (
                  <ThemedText key={index} type="small" themeColor="textSecondary">
                    {item.label}: {item.gap}
                  </ThemedText>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
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
    gap: Spacing.four,
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
  headline: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  bigNumberRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  bigNumber: {
    fontFamily: FontFamily.serif,
    fontSize: 44,
    lineHeight: 48,
  },
  bigNumberNote: {
    flex: 1,
    paddingBottom: Spacing.one,
  },
  section: {
    gap: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  kicker: {
    ...KickerStyle,
    flexShrink: 1,
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
    gap: Spacing.two,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.body,
    flexShrink: 1,
  },
  evidence: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.two,
    gap: Spacing.one,
  },
  quote: {
    fontFamily: FontFamily.serif,
    fontStyle: 'italic',
  },
  evidenceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
});
