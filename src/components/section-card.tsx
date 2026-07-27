import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SectionCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  /** Podanie `onPress` zamienia zaślepkę w działającą kartę. */
  onPress?: () => void;
  /** Liczba nowych elementów. Pokazywana zamiast etykiety "Wkrótce". */
  badge?: number;
};

/**
 * Karta sekcji na ekranach-hubach (Pulpit, Analizy, Dane): ikona, tytuł,
 * opis i chevron. Bez `onPress` renderuje się jako zaślepka z plakietką
 * "Wkrótce".
 */
export function SectionCard({ icon, title, description, onPress, badge }: SectionCardProps) {
  const theme = useTheme();
  const ready = Boolean(onPress);

  const body = (pressed: boolean) => (
    <>
      <View style={styles.cardHeader}>
        <Ionicons name={icon} size={20} color={theme.accent} />
        <ThemedText style={styles.cardTitle}>{title}</ThemedText>
        {ready ? (
          badge && badge > 0 ? (
            <View style={[styles.badge, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="small" themeColor="accentLight">
                {badge} nowych
              </ThemedText>
            </View>
          ) : (
            <Ionicons
              name="chevron-forward"
              size={18}
              color={pressed ? theme.accent : theme.textSecondary}
            />
          )
        ) : (
          <View style={[styles.badge, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="small" themeColor="textSecondary">
              Wkrótce
            </ThemedText>
          </View>
        )}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {description}
      </ThemedText>
    </>
  );

  if (!onPress) {
    return (
      <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
        {body(false)}
      </ThemedView>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Otwórz: ${title}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
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
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  cardTitle: {
    fontFamily: FontFamily.sansSemiBold,
    flex: 1,
  },
  badge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
});
