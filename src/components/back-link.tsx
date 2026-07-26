/**
 * Powrót na poprzedni ekran ("< Wróć").
 *
 * Ten sam Pressable z ikoną i tym samym stylem `back` był skopiowany na
 * ośmiu ekranach, w kilku wariantach na kolejnych pięciu. Poza duplikacją
 * miał wspólny problem dostępności: wysokość wiersza to około 20 px, czyli
 * mocno poniżej zalecanych 44 px celu dotyku, i żadna kopia nie miała
 * `hitSlop`. Tutaj minimalna wysokość i hitSlop są wbudowane, więc kolejne
 * użycie nie może o nich zapomnieć.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type BackLinkProps = {
  /** Domyślnie "Wróć". Zmieniaj tylko, gdy cel powrotu nie jest oczywisty. */
  label?: string;
  /** Własna akcja zamiast router.back(), np. powrót do konkretnej zakładki. */
  onPress?: () => void;
};

export function BackLink({ label = 'Wróć', onPress }: BackLinkProps) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress ?? (() => router.back())}
      hitSlop={12}
      style={styles.back}>
      <Ionicons name="chevron-back" size={20} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
    // Cel dotyku: 44 px to minimum z wytycznych iOS i Androida.
    minHeight: 44,
    paddingRight: Spacing.two,
  },
});
