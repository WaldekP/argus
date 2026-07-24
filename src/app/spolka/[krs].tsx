/**
 * Karta spółki z KRS. Wejście z listy powiązań polityka.
 *
 * Dane rejestrowe (kapitał, PKD, okresy sprawozdań) pochodzą z darmowego API
 * Ministerstwa Sprawiedliwości. Kwoty ze sprawozdań i skład osobowy to płatne
 * Rejestr.io, pobierane raz na spółkę i trzymane w cache'u.
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  BottomTabInset,
  FontFamily,
  FontSize,
  KickerStyle,
  MaxContentWidth,
  Radius,
  Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PrimaryButton } from '@/components/primary-button';
import { RegistryAttribution } from '@/components/registry-attribution';
import {
  type CompanyContext,
  getCompanyContext,
  getOrgDetails,
  type OrgDetails,
} from '@/lib/api/registry';
import { formatDateNumeric, formatMoney, formatYear } from '@/lib/format';

/** Flagi stanu spółki warte pokazania na górze karty. */
const STATUS_FLAGS: { key: string; label: string; alarming: boolean }[] = [
  { key: 'w_likwidacji', label: 'w likwidacji', alarming: true },
  { key: 'w_upadlosci', label: 'w upadłości', alarming: true },
  { key: 'w_zawieszeniu', label: 'zawieszona', alarming: true },
  { key: 'czy_wykreslona', label: 'wykreślona z KRS', alarming: true },
  { key: 'czy_spolka_skarbu_panstwa', label: 'spółka Skarbu Państwa', alarming: false },
  { key: 'czy_pozytku_publicznego', label: 'organizacja pożytku publicznego', alarming: false },
  { key: 'czy_jest_na_gpw', label: 'notowana na GPW', alarming: false },
  { key: 'czy_dofinansowana_przez_ue', label: 'dofinansowanie z UE', alarming: false },
  { key: 'czy_otrzymala_pomoc_publiczna', label: 'pomoc publiczna', alarming: false },
];

function formatAddress(address: Record<string, unknown>): string {
  const street = [address.ulica, address.nr_domu].filter(Boolean).join(' ');
  const city = [address.kod, address.miejscowosc].filter(Boolean).join(' ');
  const full = [street, city].filter(Boolean).join(', ');
  return full || 'brak danych';
}

export default function CompanyScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { krs } = useLocalSearchParams<{ krs: string }>();
  const [details, setDetails] = useState<OrgDetails | null>(null);
  const [context, setContext] = useState<CompanyContext | null>(null);
  const [contextBusy, setContextBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Zestawienie generujemy na zadanie, bo kosztuje wywolanie modelu.
  const handleContext = async () => {
    setContextBusy(true);
    setError(null);
    try {
      setContext(await getCompanyContext(krs ?? ''));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setContextBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result = await getOrgDetails(krs ?? '');
        if (!cancelled) setDetails(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [krs]);

  const org = details?.org;
  const flags = STATUS_FLAGS.filter((flag) => org?.status?.[flag.key]);
  const latest = details?.filings?.[0] ?? null;

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.three, paddingBottom: BottomTabInset + Spacing.five },
        ]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
          style={styles.back}
          accessibilityRole="button">
          <Ionicons name="chevron-back" size={20} color={theme.accentLight} />
          <ThemedText type="small" themeColor="accentLight">
            Wróć
          </ThemedText>
        </Pressable>

        {loading ? <ThemedText>Wczytywanie danych z rejestru.</ThemedText> : null}

        {error ? (
          <ThemedText themeColor="error" type="small">
            {error}
          </ThemedText>
        ) : null}

        {org ? (
          <>
            <ThemedText style={styles.title}>{org.name_full}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {org.legal_form ?? 'brak danych'}. KRS {org.krs}.
            </ThemedText>

            {flags.length > 0 ? (
              <View style={styles.chipRow}>
                {flags.map((flag) => (
                  <View
                    key={flag.key}
                    style={[
                      styles.chip,
                      { borderColor: flag.alarming ? theme.error : theme.borderStrong },
                    ]}>
                    <ThemedText
                      type="small"
                      themeColor={flag.alarming ? 'error' : 'accentLight'}
                      style={styles.chipText}>
                      {flag.label}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Trzy liczby, które mówią o skali podmiotu */}
            <View style={[styles.panel, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}>
              <View style={styles.metricsRow}>
                <View style={styles.metric}>
                  <ThemedText style={[KickerStyle, styles.kicker]} themeColor="accent">
                    Kapitał zakładowy
                  </ThemedText>
                  <ThemedText style={[styles.metricValue, { color: theme.accentLight }]}>
                    {formatMoney(org.capital_amount, org.capital_currency)}
                  </ThemedText>
                </View>
                <View style={styles.metric}>
                  <ThemedText style={[KickerStyle, styles.kicker]} themeColor="accent">
                    W rejestrze od
                  </ThemedText>
                  <ThemedText style={[styles.metricValue, { color: theme.accentLight }]}>
                    {formatYear(org.registered_on)}
                  </ThemedText>
                </View>
                <View style={styles.metric}>
                  <ThemedText style={[KickerStyle, styles.kicker]} themeColor="accent">
                    Ostatni wpis
                  </ThemedText>
                  <ThemedText style={[styles.metricValue, { color: theme.accentLight }]}>
                    {formatDateNumeric(org.last_entry_on)}
                  </ThemedText>
                </View>
              </View>
            </View>

            <ThemedText style={[KickerStyle, styles.sectionKicker]} themeColor="accent">
              Sprawozdania finansowe
            </ThemedText>
            {latest ? (
              <ThemedText type="small" themeColor="text80">
                Ostatnie sprawozdanie dotyczy roku {formatYear(latest.period_end)} i zostało
                złożone {formatDateNumeric(latest.filed_on)}. Liczba wzmianek o złożonych sprawozdaniach
                w rejestrze: {details?.filings.length}.
              </ThemedText>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                Brak wzmianek o złożonych sprawozdaniach finansowych. Dla spółki prowadzącej
                działalność to sam w sobie jest temat na pytanie od dziennikarza.
              </ThemedText>
            )}

            {details?.filings.slice(0, 8).map((filing) => (
              <View
                key={`${filing.period_start}-${filing.period_end}`}
                style={[styles.filingRow, { borderColor: theme.border }]}>
                <ThemedText style={styles.filingYear} themeColor="accentLight">
                  {formatYear(filing.period_end)}
                </ThemedText>
                <View style={styles.filingBody}>
                  <ThemedText type="small">
                    Złożone {formatDateNumeric(filing.filed_on)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Przychód: {formatMoney(filing.revenue, filing.currency)}. Wynik netto:{' '}
                    {formatMoney(filing.net_result, filing.currency)}.
                  </ThemedText>
                </View>
              </View>
            ))}

            {/* Zestawienie branży spółki z dorobkiem parlamentarnym polityka.
                Model dostaje wyłącznie znalezione głosowania i wypowiedzi,
                a brak materiału ma prowadzić do zdania "brak danych". */}
            <ThemedText style={[KickerStyle, styles.sectionKicker]} themeColor="accent">
              Spółka a głosowania
            </ThemedText>
            {context ? (
              <View
                style={[
                  styles.notice,
                  {
                    borderLeftColor:
                      context.evidence?.risk === 'ryzyko'
                        ? theme.error
                        : context.evidence?.risk === 'pytanie'
                          ? theme.accent
                          : theme.teal,
                  },
                ]}>
                <ThemedText type="small" themeColor="text80">
                  {context.summary}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Podstawa: {context.votes_found} głosowań i {context.statements_found} wypowiedzi
                  dopasowanych tematycznie do branży spółki.
                </ThemedText>
                {(context.evidence?.votes ?? []).map((vote) => (
                  <ThemedText
                    key={`${vote.date}-${vote.title}`}
                    type="small"
                    themeColor="textSecondary">
                    {formatDateNumeric(vote.date)}: {vote.title}. Głos: {vote.vote}.
                  </ThemedText>
                ))}
              </View>
            ) : (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  Argus zestawi branżę tej spółki z Twoimi głosowaniami i wypowiedziami w Sejmie,
                  żeby pokazać, o co może zapytać dziennikarz.
                </ThemedText>
                <PrimaryButton
                  title="Zestaw z moimi głosowaniami"
                  variant="secondary"
                  onPress={handleContext}
                  loading={contextBusy}
                />
              </>
            )}

            {/* Inni politycy w tej samej spółce. Dopasowanie po nazwisku ORAZ
                dacie urodzenia jest pewne, samo nazwisko to poszlaka. */}
            {details?.politicians && details.politicians.length > 0 ? (
              <>
                <ThemedText style={[KickerStyle, styles.sectionKicker]} themeColor="accent">
                  Politycy w tej spółce
                </ThemedText>
                {details.politicians.map((person) => (
                  <View
                    key={`mp-${person.full_name}-${person.role_label}`}
                    style={[styles.filingRow, { borderColor: theme.accent }]}>
                    <View style={styles.filingBody}>
                      <ThemedText type="small">
                        {person.full_name}
                        {person.sejm_club ? `, klub ${person.sejm_club}` : ''}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {person.role_label}, od {formatDateNumeric(person.date_start)}
                        {person.is_current ? '' : ` do ${formatDateNumeric(person.date_end)}`}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        themeColor={person.match_basis === 'birth_date' ? 'teal' : 'error'}>
                        {person.match_basis === 'birth_date'
                          ? 'Poseł potwierdzony nazwiskiem i datą urodzenia.'
                          : 'Dopasowanie po samym nazwisku, wymaga weryfikacji.'}
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </>
            ) : null}

            {details?.people && details.people.length > 0 ? (
              <>
                <ThemedText style={[KickerStyle, styles.sectionKicker]} themeColor="accent">
                  Skład osobowy
                </ThemedText>
                {details.people.map((person) => (
                  <View
                    key={`${person.full_name}-${person.role_label}-${person.date_start}`}
                    style={[styles.filingRow, { borderColor: theme.border }]}>
                    <View style={styles.filingBody}>
                      <ThemedText type="small">
                        {person.full_name}
                        {person.birth_date ? ` (ur. ${person.birth_date.slice(0, 4)})` : ''}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {person.role_label}, od {formatDateNumeric(person.date_start)}
                        {person.is_current ? ', nadal' : ` do ${formatDateNumeric(person.date_end)}`}
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </>
            ) : null}

            <ThemedText style={[KickerStyle, styles.sectionKicker]} themeColor="accent">
              Przedmiot działalności
            </ThemedText>
            {org.pkd_all.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Brak danych o PKD.
              </ThemedText>
            ) : (
              org.pkd_all.map((pkd) => (
                <ThemedText
                  key={`${pkd.code}-${pkd.description}`}
                  type="small"
                  themeColor={pkd.main ? 'text' : 'textSecondary'}>
                  {pkd.main ? 'Przeważająca: ' : ''}
                  {pkd.code} {pkd.description}
                </ThemedText>
              ))
            )}

            <ThemedText style={[KickerStyle, styles.sectionKicker]} themeColor="accent">
              Dane rejestrowe
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              NIP: {org.nip ?? 'brak danych'}. REGON: {org.regon ?? 'brak danych'}.
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Adres: {formatAddress(org.address ?? {})}
            </ThemedText>

            <RegistryAttribution note={details?.limits.note} />
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
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.screenTitle,
    lineHeight: FontSize.screenTitle * 1.2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  chipText: {
    fontSize: 12,
  },
  panel: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
    marginTop: Spacing.two,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.four,
  },
  metric: {
    gap: 2,
    minWidth: 140,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 11 * 0.24,
  },
  sectionKicker: {
    marginTop: Spacing.four,
  },
  metricValue: {
    fontFamily: FontFamily.serif,
    fontSize: 24,
    lineHeight: 30,
  },
  filingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.small,
    padding: Spacing.three,
  },
  filingYear: {
    fontFamily: FontFamily.serif,
    fontSize: 20,
    minWidth: 48,
  },
  filingBody: {
    flex: 1,
    gap: 2,
  },
  notice: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.three,
    paddingVertical: Spacing.two,
    marginTop: Spacing.two,
  },
});
