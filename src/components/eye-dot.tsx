import { StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type EyeDotProps = ViewProps & {
  /** Średnica kropki w px. */
  size?: number;
};

/**
 * Kropka-oko: motyw Argusa zamiast zwykłego bulleta (brief designu).
 * Złoty pierścień z pawią źrenicą, imitacja punktu radialnego złoto-teal.
 */
export function EyeDot({ size = 10, style, ...rest }: EyeDotProps) {
  const theme = useTheme();
  const pupil = Math.max(3, Math.round(size * 0.45));

  return (
    <View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.accent,
        },
        style,
      ]}
      {...rest}>
      <View
        style={{
          width: pupil,
          height: pupil,
          borderRadius: pupil / 2,
          backgroundColor: theme.teal,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
