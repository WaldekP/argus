/**
 * Karta jednego powiązania z KRS: rola, od kiedy, czy nadal trwa,
 * skala spółki i ostatnie sprawozdanie finansowe.
 *
 * Hierarchia zgodna z briefem designu: jedna myśl na widok, kluczowe liczby
 * duże i złote, złoto oszczędnie. Chip roli jest jedynym mocnym akcentem,
 * bo to pierwsza rzecz, o którą zapyta dziennikarz.
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontFamily, KickerStyle, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatMoney, formatYear, yearsLabel, yearsSince } from '@/lib/format';
import type { RegistryConnection } from '@/lib/api/registry';

type Props = {
  /**
   * Wszystkie powiązania z JEDNĄ spółką. Jedna osoba bywa w tej samej spółce
   * i w zarządzie, i wspólnikiem, a dwie identyczne karty pod sobą wyglądają
   * jak błąd. Dane spółki bierzemy z pierwszego elementu, role z wszystkich.
   */
  connections: RegistryConnection[];
  onPress?: () => void;
};

/** Flagi ze stanu spółki, które zmieniają ocenę ryzyka medialnego. */
function riskFlags(status: Record<string, unknown>): string[] {
  const flags: string[] = [];
  if (status.w_likwidacji) flags.push('w likwidacji');
  if (status.w_upadlosci) flags.push('w upadłości');
  if (status.w_zawieszeniu) flags.push('zawieszona');
  if (status.czy_wykreslona) flags.push('wykreślona z KRS');
  if (status.czy_spolka_skarbu_panstwa) flags.push('spółka Skarbu Państwa');
  if (status.czy_pozytku_publicznego) flags.push('OPP');
  if (status.czy_jest_na_gpw) flags.push('GPW');
  return flags;
}

export function RegistryConnectionCard({ connections, onPress }: Props) {
  const theme = useTheme();
  const connection = connections[0];
  if (!connection) return null;

  // Data najwcześniejszego powiązania: odpowiada na pytanie "od kiedy siedzi
  // w tej spółce", niezależnie od tego, ile ról w niej pełni.
  const earliest = connections
    .map((c) => c.date_start)
    .filter((d): d is string => Boolean(d))
    .sort()[0] ?? null;
  const years = yearsSince(earliest);
  const anyCurrent = connections.some((c) => c.is_current);
  const flags = riskFlags(connection.status ?? {});
  const filing = connection.latest_filing;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.backgroundSelected, borderColor: theme.border },
        pressed && onPress ? styles.pressed : null,
      ]}>
      <ThemedText style={styles.name}>{connection.name}</ThemedText>

      <View style={styles.chipRow}>
        {connections.map((role) => (
          <View
            key={role.role_type}
            style={[styles.chip, { borderColor: theme.borderStrong }]}>
            <ThemedText type="small" themeColor="accentLight" style={styles.chipText}>
              {role.role_label}
            </ThemedText>
          </View>
        ))}
        <View
          style={[
            styles.chip,
            { borderColor: anyCurrent ? theme.teal : theme.borderStrong },
          ]}>
          <ThemedText
            type="small"
            themeColor={anyCurrent ? 'teal' : 'textSecondary'}
            style={styles.chipText}>
            {anyCurrent ? 'aktywne' : `do ${formatDate(connection.date_end)}`}
          </ThemedText>
        </View>
        {flags.map((flag) => (
          <View key={flag} style={[styles.chip, { borderColor: theme.error }]}>
            <ThemedText type="small" themeColor="error" style={styles.chipText}>
              {flag}
            </ThemedText>
          </View>
        ))}
      </View>

      <View style={[styles.metrics, { borderTopColor: theme.border }]}>
        <View style={styles.metric}>
          <ThemedText style={[KickerStyle, styles.kicker]} themeColor="accent">
            Od kiedy
          </ThemedText>
          <ThemedText style={[styles.metricValue, { color: theme.accentLight }]}>
            {formatDate(earliest)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {years === null ? 'brak danych' : yearsLabel(years)}
          </ThemedText>
        </View>

        <View style={styles.metric}>
          <ThemedText style={[KickerStyle, styles.kicker]} themeColor="accent">
            Kapitał
          </ThemedText>
          <ThemedText style={[styles.metricValue, { color: theme.accentLight }]}>
            {formatMoney(connection.capital_amount, connection.capital_currency)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {connection.legal_form ?? 'brak danych'}
          </ThemedText>
        </View>
      </View>

      <View style={[styles.filing, { borderTopColor: theme.border }]}>
        <ThemedText style={[KickerStyle, styles.kicker]} themeColor="accent">
          Sprawozdanie finansowe
        </ThemedText>
        {filing ? (
          <>
            <ThemedText type="small">
              Za {formatYear(filing.period_end)}, złożone {formatDate(filing.filed_on)}.
            </ThemedText>
            <View style={styles.metrics}>
              <View style={styles.metric}>
                <ThemedText type="small" themeColor="textSecondary">
                  Przychód
                </ThemedText>
                <ThemedText
                  style={[
                    styles.metricValue,
                    { color: filing.revenue === null ? theme.textSecondary : theme.accentLight },
                  ]}>
                  {formatMoney(filing.revenue, filing.currency)}
                </ThemedText>
              </View>
              <View style={styles.metric}>
                <ThemedText type="small" themeColor="textSecondary">
                  Wynik netto
                </ThemedText>
                <ThemedText
                  style={[
                    styles.metricValue,
                    {
                      color: filing.net_result === null
                        ? theme.textSecondary
                        : filing.net_result < 0
                          ? theme.error
                          : theme.accentLight,
                    },
                  ]}>
                  {formatMoney(filing.net_result, filing.currency)}
                </ThemedText>
              </View>
            </View>
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Brak wzmianki o złożonym sprawozdaniu w KRS.
          </ThemedText>
        )}
      </View>

      {connection.branch ? (
        <ThemedText type="small" themeColor="textSecondary">
          Branża: {connection.branch}
        </ThemedText>
      ) : null}

      <ThemedText type="small" themeColor="textSecondary">
        KRS {connection.org_krs}
        {onPress ? '. Dotknij, żeby zobaczyć szczegóły spółki.' : ''}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
  name: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
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
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.four,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
  },
  metric: {
    gap: 2,
    minWidth: 130,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 11 * 0.24,
  },
  metricValue: {
    fontFamily: FontFamily.serif,
    fontSize: 22,
    lineHeight: 28,
  },
  filing: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    gap: Spacing.one,
  },
});
