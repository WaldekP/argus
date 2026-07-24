import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { MpAvatar } from '@/components/mp-avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, FontSize, KickerStyle, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { MpDetails, MpIdentity } from '@/lib/api/onboarding';
import { formatDate, polishPlural, yearsSince } from '@/lib/format';
import { SEJM_TERM } from '@/lib/sejm-photo';

/** Liczby rekordów zaimportowanych z Sejmu (get_status.counts). */
export type MandateCounts = {
  votes: number;
  statements: number;
};

/** "Polska 2050, okręg Warszawa (nr 19)" albo tyle, ile wiadomo. */
function mandateLine(club: string | null, district: string | null, num: number | null): string {
  const parts: string[] = [];
  if (club) {
    parts.push(club);
  }
  if (district) {
    parts.push(`okręg ${district}${num ? ` (nr ${num})` : ''}`);
  }
  return parts.join(', ');
}

/** Data i miejsce urodzenia z wiekiem: "30 czerwca 1990, Grajewo (36 lat)". */
function birthLine(details: MpDetails): string | null {
  if (!details.birth_date) {
    return null;
  }
  const date = formatDate(details.birth_date);
  if (!date) {
    return null;
  }
  const age = yearsSince(details.birth_date);
  const place = details.birth_location ? `, ${details.birth_location}` : '';
  const years = age === null ? '' : ` (${polishPlural(age, 'rok', 'lata', 'lat')})`;
  return `${date}${place}${years}`;
}

function Chip({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.chip, { borderColor: theme.border }]}>
      <ThemedText type="small" themeColor="accentLight" style={styles.chipLabel}>
        {label}
      </ThemedText>
    </View>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dataRow}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.dataLabel}>
        {label}
      </ThemedText>
      <ThemedText type="small" style={styles.dataValue}>
        {value}
      </ThemedText>
    </View>
  );
}

type StatProps = {
  value: number;
  label: string;
  onPress?: () => void;
};

/** Duża złota liczba. Z `onPress` staje się wejściem w szczegóły. */
function StatNumber({ value, label, onPress }: StatProps) {
  const theme = useTheme();

  const body = (pressed: boolean) => (
    <>
      <ThemedText themeColor="accent" style={styles.statValue}>
        {value}
      </ThemedText>
      <View style={styles.statLabelRow}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        {onPress ? (
          <Ionicons
            name="chevron-forward"
            size={16}
            color={pressed ? theme.accent : theme.textSecondary}
          />
        ) : null}
      </View>
    </>
  );

  if (!onPress) {
    return <View style={styles.stat}>{body(false)}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Otwórz: ${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.stat, styles.statPressable, pressed && styles.dimmed]}>
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

export type MpMandateCardProps = {
  identity: MpIdentity;
  /** Pełne dane z API Sejmu. Null, dopóki się nie wczytają. */
  details: MpDetails | null;
  detailsLoading?: boolean;
  /** Komunikat po polsku, gdy API Sejmu nie odpowiedziało. */
  detailsError?: string | null;
  counts: MandateCounts | null;
  onOpenStatements?: () => void;
};

/**
 * Karta mandatu na ekranie Profil: jedyne miejsce w aplikacji, w którym
 * pokazujemy zdjęcie posła. Dane osobowe i mandatowe pochodzą wprost z API
 * Sejmu, liczby po prawej z bazy Argusa.
 */
export function MpMandateCard({
  identity,
  details,
  detailsLoading = false,
  detailsError = null,
  counts,
  onOpenStatements,
}: MpMandateCardProps) {
  const theme = useTheme();

  const club = details?.club ?? identity.club;
  const districtName = details?.district_name ?? identity.district_name;
  const districtNum = details?.district_num ?? identity.district_num;
  const voivodeship = details?.voivodeship ?? identity.voivodeship;
  const line = mandateLine(club, districtName, districtNum);
  const hasData = counts !== null && counts.votes + counts.statements > 0;
  const birth = details ? birthLine(details) : null;

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.cardHeader}>
        <ThemedText themeColor="accent" style={styles.kicker}>
          Mandat poselski
        </ThemedText>
        {details ? <Chip label={details.active ? 'Mandat aktywny' : 'Mandat wygaszony'} /> : null}
      </View>

      <View style={styles.identityRow}>
        <MpAvatar mpId={identity.mp_id} name={identity.full_name} size={96} />
        <View style={styles.identityText}>
          <ThemedText style={styles.name}>{details?.full_name ?? identity.full_name}</ThemedText>
          {line ? (
            <ThemedText type="small" themeColor="textSecondary">
              {line}
            </ThemedText>
          ) : null}
          <View style={styles.chips}>
            {voivodeship ? <Chip label={voivodeship} /> : null}
            <Chip label={`Kadencja ${SEJM_TERM}`} />
          </View>
        </View>
      </View>

      {details && !details.active && (details.inactive_cause || details.waiver_desc) ? (
        <View style={[styles.notice, { borderLeftColor: theme.error }]}>
          <ThemedText type="small" themeColor="text80">
            {details.inactive_cause ?? 'Mandat wygaszony'}
            {details.waiver_desc ? `. ${details.waiver_desc}` : ''}
          </ThemedText>
        </View>
      ) : null}

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      {hasData ? (
        <>
          <View style={styles.stats}>
            <StatNumber value={counts.votes} label="Twoich głosów" />
            <StatNumber
              value={counts.statements}
              label="wystąpień w Sejmie"
              onPress={onOpenStatements}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Te dane Argus zna i bierze pod uwagę w briefach, przekazach i alertach spójności.
          </ThemedText>
        </>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Mandat jest rozpoznany, ale głosowania i wystąpienia nie zostały jeszcze pobrane.
          Możesz uruchomić import z onboardingu.
        </ThemedText>
      )}

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      {details ? (
        <View style={styles.dataList}>
          {details.profession ? <DataRow label="Zawód" value={details.profession} /> : null}
          {details.education_level ? (
            <DataRow label="Wykształcenie" value={details.education_level} />
          ) : null}
          {birth ? <DataRow label="Urodzony_a" value={birth} /> : null}
          {details.number_of_votes !== null ? (
            <DataRow
              label="Głosów w wyborach"
              value={details.number_of_votes.toLocaleString('pl-PL')}
            />
          ) : null}
          {details.email ? <DataRow label="E-mail sejmowy" value={details.email} /> : null}
          <ThemedText type="small" themeColor="textSecondary" style={styles.source}>
            Źródło: otwarte API Sejmu, kadencja {SEJM_TERM}.
          </ThemedText>
        </View>
      ) : detailsLoading ? (
        <View style={styles.detailsPlaceholder}>
          <ActivityIndicator color={theme.accent} />
          <ThemedText type="small" themeColor="textSecondary">
            Pobieram dane z Sejmu
          </ThemedText>
        </View>
      ) : (
        <ThemedText type="small" themeColor={detailsError ? 'error' : 'textSecondary'}>
          {detailsError ?? 'Dane z Sejmu nie zostały jeszcze pobrane.'}
        </ThemedText>
      )}
    </ThemedView>
  );
}

export type MpMandateBarProps = {
  identity: MpIdentity;
  onPress?: () => void;
};

/**
 * Pasek powitalny na ekranie Dziś: mandat bez zdjęcia. Zdjęcie profilowe
 * pokazujemy wyłącznie w zakładce Profil (decyzja usera 2026-07-24).
 */
export function MpMandateBar({ identity, onPress }: MpMandateBarProps) {
  const theme = useTheme();
  const line = mandateLine(identity.club, identity.district_name, identity.district_num);

  const body = (pressed: boolean) => (
    <>
      <View style={styles.barText}>
        <ThemedText style={styles.barName}>{identity.full_name}</ThemedText>
        {line ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {line}
          </ThemedText>
        ) : null}
      </View>
      {onPress ? (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={pressed ? theme.accent : theme.textSecondary}
        />
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <ThemedView type="backgroundElement" style={[styles.bar, { borderColor: theme.border }]}>
        {body(false)}
      </ThemedView>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Otwórz profil"
      onPress={onPress}
      style={({ pressed }) => [
        styles.bar,
        {
          backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
          borderColor: theme.border,
        },
      ]}>
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  kicker: {
    ...KickerStyle,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  identityText: {
    flex: 1,
    gap: Spacing.one,
  },
  name: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.section,
    lineHeight: FontSize.section * 1.3,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.half,
  },
  chipLabel: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  notice: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.three,
    paddingVertical: Spacing.one,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.five,
    flexWrap: 'wrap',
  },
  stat: {
    gap: Spacing.one,
  },
  statPressable: {
    borderRadius: Radius.small,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  statValue: {
    fontFamily: FontFamily.serif,
    fontSize: 40,
    lineHeight: 46,
  },
  dimmed: {
    opacity: 0.7,
  },
  dataList: {
    gap: Spacing.two,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  dataLabel: {
    width: 150,
  },
  dataValue: {
    flex: 1,
  },
  source: {
    marginTop: Spacing.one,
  },
  detailsPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
  },
  barText: {
    flex: 1,
    gap: Spacing.half,
  },
  barName: {
    fontFamily: FontFamily.sansSemiBold,
  },
});
