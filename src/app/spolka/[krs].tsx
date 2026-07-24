/**
 * Karta spółki z KRS. Wejście z listy powiązań polityka.
 *
 * Wszystko na tym ekranie pochodzi z darmowego otwartego API Ministerstwa
 * Sprawiedliwości albo z cache'u, więc otwieranie karty nie zużywa środków
 * z konta Rejestr.io.
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
import { getOrgDetails, type OrgDetails } from '@/lib/api/registry';
import { formatDate, formatMoney, formatYear } from '@/lib/format';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button">
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
                    {formatDate(org.last_entry_on)}
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
                złożone {formatDate(latest.filed_on)}. Liczba wzmianek o złożonych sprawozdaniach
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
                    Złożone {formatDate(filing.filed_on)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Przychód: {formatMoney(filing.revenue, filing.currency)}. Wynik netto:{' '}
                    {formatMoney(filing.net_result, filing.currency)}.
                  </ThemedText>
                </View>
              </View>
            ))}

            {details?.limits.financial_amounts === false ? (
              <View style={[styles.notice, { borderLeftColor: theme.teal }]}>
                <ThemedText type="small" themeColor="text80">
                  {details.limits.note}
                </ThemedText>
              </View>
            ) : null}

            {details?.known_people && details.known_people.length > 0 ? (
              <>
                <ThemedText style={[KickerStyle, styles.sectionKicker]} themeColor="accent">
                  Znane nam osoby
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Wyłącznie osoby, których tożsamość ktoś potwierdził w Argusie. To nie jest pełny
                  skład zarządu.
                </ThemedText>
                {details.known_people.map((person) => (
                  <View
                    key={`${person.full_name}-${person.role_label}`}
                    style={[styles.filingRow, { borderColor: theme.border }]}>
                    <View style={styles.filingBody}>
                      <ThemedText type="small">{person.full_name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {person.role_label}, od {formatDate(person.date_start)}
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
