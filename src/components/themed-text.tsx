/**
 * Tekst z kolorem z motywu i krojem z tabeli fontów.
 *
 * Ważne: `fontFamily` musi być podane wprost. Fonty ładujemy jako osobne
 * rodziny per grubość (Inter_400Regular, Inter_500Medium, ...), więc samo
 * `fontWeight: 500` nie wybiera Inter Medium, tylko zostawia krój systemowy.
 * Dlatego każdy wariant wskazuje rodzinę z `FontFamily`, a nie grubość.
 */

import { StyleSheet, Text, type TextProps } from 'react-native';

import { FontFamily, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'small' | 'smallBold';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  smallBold: {
    fontFamily: FontFamily.sansBold,
    fontSize: 14,
    lineHeight: 20,
  },
  default: {
    fontFamily: FontFamily.sans,
    fontSize: 16,
    lineHeight: 24,
  },
});
