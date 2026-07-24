import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MpMandateBar } from '@/components/mp-mandate';
import { ScreenPlaceholder } from '@/components/screen-placeholder';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listMentions } from '@/lib/api/mentions';
import { readMpIdentity } from '@/lib/api/onboarding';
import { useOnboardingStore } from '@/store/onboarding';

type SectionCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  /** Podanie `onPress` zamienia zaślepkę w działającą kartę. */
  onPress?: () => void;
  /** Liczba nowych elementów. Pokazywana zamiast etykiety "Wkrótce". */
  badge?: number;
};

function SectionCard({ icon, title, description, onPress, badge }: SectionCardProps) {
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

/** Karta aktywnej sekcji: prowadzi do gotowego feature'u. */
function LinkCard({
  icon,
  title,
  description,
  onPress,
}: SectionCardProps & { onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        pressed && styles.dimmed,
      ]}>
      <View style={styles.cardHeader}>
        <Ionicons name={icon} size={20} color={theme.accent} />
        <ThemedText style={styles.cardTitle}>{title}</ThemedText>
        <Ionicons name="arrow-forward" size={18} color={theme.accentLight} />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {description}
      </ThemedText>
    </Pressable>
  );
}

export default function TodayScreen() {
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const identity = readMpIdentity(useOnboardingStore((state) => state.profile));

  // Licznik odświeżamy przy każdym wejściu w zakładkę, nie tylko przy montażu:
  // użytkownik wraca z briefu po przeczytaniu wzmianek i liczba ma spaść.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      listMentions({ only_unread: true, limit: 200 })
        .then((result) => {
          if (active) setUnread(result.mentions.length);
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <ScreenPlaceholder
      title="Dziś"
      description="Dzień dobry. Tu zobaczysz wszystko, co ważne na dzisiaj: syntezę prasową, plan wywiadów i ostrzeżenia spójności.">
      <View style={styles.cards}>
        {identity ? (
          <MpMandateBar identity={identity} onPress={() => router.push('/profile')} />
        ) : null}

        <LinkCard
          icon="search-outline"
          title="Analizy niespójności"
          description="Wskaż temat i cel, a Argus znajdzie sprzeczności w wypowiedziach i głosowaniach z Sejmu."
          onPress={() => router.push('/analysis')}
        />

        <SectionCard
          icon="sunny-outline"
          title="Brief poranny"
          description="Wzmianki z prasy i portali pod Twoje hasła, zebrane w jednym miejscu."
          badge={unread}
          onPress={() => router.push('/brief-poranny')}
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
  dimmed: {
    opacity: 0.7,
  },
});
