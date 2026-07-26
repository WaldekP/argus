import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, KickerStyle, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PoliticianProfile } from '@/lib/api/onboarding';

type Section = {
  label: string;
  value: string;
};

/** Skraca podgląd długiego pola: karta ma tylko sygnalizować, że coś jest. */
function preview(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.length > 160 ? `${trimmed.slice(0, 160)}…` : trimmed;
}

/**
 * Karta "Kontekst dla Argusa" na ekranie Profil: podgląd trzech ręcznie
 * wpisanych sekcji (o kandydacie, o partii, stanowiska) i wejście do edycji.
 * Te same pola Argus wstrzykuje do generacji przekazu.
 */
export function ContextCard({
  profile,
  onEdit,
}: {
  profile: PoliticianProfile | null;
  onEdit: () => void;
}) {
  const theme = useTheme();

  const sections: Section[] = [
    { label: 'O kandydacie', value: preview(profile?.bio) ?? '' },
    { label: 'O partii', value: preview(profile?.party_profile) ?? '' },
    { label: 'Stanowiska wobec tematów', value: preview(profile?.topic_positions) ?? '' },
  ];
  const hasAny = sections.some((section) => section.value.length > 0);

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.header}>
        <ThemedText themeColor="accent" style={styles.kicker}>
          Kontekst dla Argusa
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edytuj kontekst"
          onPress={onEdit}
          hitSlop={8}
          style={({ pressed }) => [styles.editButton, pressed && styles.dimmed]}>
          <Ionicons name="create-outline" size={18} color={theme.accent} />
          <ThemedText type="small" themeColor="accent" style={styles.editLabel}>
            {hasAny ? 'Edytuj' : 'Dodaj'}
          </ThemedText>
        </Pressable>
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        Wiedza o kandydacie, jego partii i stanowiskach. Argus bierze to pod uwagę w przekazach,
        briefach i alertach spójności.
      </ThemedText>

      {hasAny ? (
        <View style={styles.sections}>
          {sections.map((section) => (
            <View key={section.label} style={styles.section}>
              <ThemedText type="small" themeColor="accentLight" style={styles.sectionLabel}>
                {section.label}
              </ThemedText>
              {section.value ? (
                <ThemedText type="small" themeColor="text80">
                  {section.value}
                </ThemedText>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  Nie dodano.
                </ThemedText>
              )}
            </View>
          ))}
        </View>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Nie dodano jeszcze żadnego kontekstu. Dotknij „Dodaj”, żeby wpisać.
        </ThemedText>
      )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: {
    ...KickerStyle,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  editLabel: {
    fontFamily: FontFamily.sansSemiBold,
  },
  dimmed: {
    opacity: 0.6,
  },
  sections: {
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  section: {
    gap: Spacing.half,
  },
  sectionLabel: {
    fontFamily: FontFamily.sansSemiBold,
  },
});
