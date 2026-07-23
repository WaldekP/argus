import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ScreenPlaceholder } from '@/components/screen-placeholder';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SectionCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
};

function SectionCard({ icon, title, description }: SectionCardProps) {
  const theme = useTheme();

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.cardHeader}>
        <Ionicons name={icon} size={20} color={theme.accent} />
        <ThemedText style={styles.cardTitle}>{title}</ThemedText>
        <View style={[styles.badge, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="small" themeColor="textSecondary">
            Wkrótce
          </ThemedText>
        </View>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {description}
      </ThemedText>
    </ThemedView>
  );
}

export default function TodayScreen() {
  return (
    <ScreenPlaceholder
      title="Dziś"
      description="Dzień dobry. Tu zobaczysz wszystko, co ważne na dzisiaj: syntezę prasową, plan wywiadów i ostrzeżenia spójności.">
      <View style={styles.cards}>
        <SectionCard
          icon="sunny-outline"
          title="Brief poranny"
          description="Codzienna synteza wiadomości i stenogramów pod Twoje tematy, gotowa o 6:30."
        />
        <SectionCard
          icon="mic-outline"
          title="Nadchodzące wywiady"
          description="Zaplanowane rozmowy z mediami wraz z briefami przygotowanymi przez Argusa."
        />
        <SectionCard
          icon="alert-circle-outline"
          title="Alerty spójności"
          description="Ostrzeżenia, gdy nowy przekaz rozjeżdża się z historią głosowań i wypowiedzi."
        />
      </View>
    </ScreenPlaceholder>
  );
}

const styles = StyleSheet.create({
  cards: {
    gap: Spacing.three,
  },
  card: {
    borderRadius: 16,
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
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
});
