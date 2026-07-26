import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  BottomTabInset,
  FontFamily,
  FontSize,
  KickerStyle,
  MaxContentWidth,
  Radius,
  Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { track } from '@/lib/analytics/posthog';
import {
  LATA_PROGRAMOW,
  programyZRoku,
  urlProgramu,
  type ProgramWyborczy,
} from '@/lib/knowledge/programy-wyborcze';
import { openExternalUrl } from '@/lib/open-url';

/**
 * Programy wyborcze partii sejmowych 2011-2023: lista PDF-ów do pobrania,
 * pogrupowana po roku wyborów. Pliki leżą w publicznym buckecie Storage,
 * pochodzenie każdego dokumentu opisuje docs/programy-wyborcze/README.md.
 */
export default function ProgramyWyborczeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const openProgram = (program: ProgramWyborczy) => {
    track('election_program_downloaded', { rok: program.rok, partia: program.partia });
    void openExternalUrl(urlProgramu(program));
  };

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.three, paddingBottom: BottomTabInset + Spacing.six },
        ]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Wróć do zakładki Przekaz"
          onPress={() => router.back()}
          style={styles.back}>
          <Ionicons name="chevron-back" size={18} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary">
            Przekaz
          </ThemedText>
        </Pressable>

        <View style={styles.header}>
          <ThemedText style={styles.title}>Programy wyborcze</ThemedText>
          <ThemedText themeColor="textSecondary">
            Oficjalne dokumenty programowe partii, które zdobyły mandaty w wyborach do Sejmu w
            latach 2011, 2015, 2019 i 2023. Dotknij pozycji, aby pobrać PDF.
          </ThemedText>
        </View>

        {LATA_PROGRAMOW.map((rok) => (
          <View key={rok} style={styles.yearSection}>
            <ThemedText themeColor="accentLight" style={styles.kicker}>
              Wybory {rok}
            </ThemedText>

            <View style={styles.cards}>
              {programyZRoku(rok).map((program) => (
                <Pressable
                  key={program.plik}
                  accessibilityRole="button"
                  accessibilityLabel={`Pobierz PDF: ${program.partia}, ${program.tytul}, ${program.rozmiar}`}
                  onPress={() => openProgram(program)}
                  style={({ pressed }) => [
                    styles.card,
                    { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                    pressed && styles.dimmed,
                  ]}>
                  <View style={styles.cardTexts}>
                    <ThemedText style={styles.cardParty}>{program.partia}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {program.tytul}
                    </ThemedText>
                    {program.uwaga ? (
                      <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                        {program.uwaga}
                      </ThemedText>
                    ) : null}
                  </View>
                  <View style={styles.download}>
                    <Ionicons name="download-outline" size={18} color={theme.teal} />
                    <ThemedText type="small" themeColor="textSecondary">
                      {program.rozmiar}
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <ThemedText type="small" themeColor="textSecondary">
          Dokumenty pochodzą ze stron komitetów oraz archiwów publicznych (Web Archive, Manifesto
          Project, Demagog, ISP PAN). Pełny audyt źródeł znajduje się w repozytorium projektu.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
  },
  header: {
    gap: Spacing.two,
  },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.screenTitle,
    lineHeight: FontSize.screenTitle * 1.25,
  },
  kicker: {
    ...KickerStyle,
  },
  yearSection: {
    gap: Spacing.three,
  },
  cards: {
    gap: Spacing.three,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.four,
  },
  cardTexts: {
    flex: 1,
    gap: Spacing.one,
  },
  cardParty: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.section,
    lineHeight: FontSize.section * 1.3,
  },
  note: {
    fontStyle: 'italic',
  },
  download: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  dimmed: {
    opacity: 0.7,
  },
});
