import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  /** 'primary' = złote CTA, 'secondary' = obrys na tle karty. */
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
};

/** Przycisk zgodny z design systemem (akcent złoty, tekst onAccent). */
export function PrimaryButton({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: PrimaryButtonProps) {
  const theme = useTheme();
  const isPrimary = variant === 'primary';
  const blocked = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={blocked}
      style={({ pressed }) => [
        styles.button,
        isPrimary
          ? { backgroundColor: theme.cta }
          : { backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.border },
        (pressed || blocked) && styles.dimmed,
      ]}>
      {loading ? (
        <ActivityIndicator color={isPrimary ? theme.onAccent : theme.text} />
      ) : (
        <ThemedText
          themeColor={isPrimary ? 'onAccent' : 'text'}
          style={styles.label}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  dimmed: {
    opacity: 0.7,
  },
  label: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 16,
  },
});
