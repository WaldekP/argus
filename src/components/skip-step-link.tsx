import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export type SkipStepLinkProps = {
  /** Etykieta, np. "Pomiń ten krok". */
  title?: string;
  onPress: () => void;
  disabled?: boolean;
};

/**
 * Dyskretny link pomijania kroku onboardingu. Żaden krok nie jest
 * obowiązkowy (decyzja usera z 2026-07-23).
 */
export function SkipStepLink({ title = 'Pomiń ten krok', onPress, disabled }: SkipStepLinkProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.link, (pressed || disabled) && styles.dimmed]}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  text: {
    textDecorationLine: 'underline',
  },
  dimmed: {
    opacity: 0.6,
  },
});
