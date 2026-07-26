import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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
  type ThemeColor,
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
 * Pozycje z lat 2019 i 2023 mają rozwijane podsumowanie (postulaty plus
 * warstwa strategiczna); pole `podsumowanie` w danych pilnuje, które karty je mają.
 */
export default function ProgramyWyborczeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [rozwiniete, setRozwiniete] = useState<Set<string>>(new Set());

  const openProgram = (program: ProgramWyborczy) => {
    track('election_program_downloaded', { rok: program.rok, partia: program.partia });
    void openExternalUrl(urlProgramu(program));
  };

  const przelaczPodsumowanie = (plik: string) => {
    setRozwiniete((poprzednie) => {
      const nastepne = new Set(poprzednie);
      if (nastepne.has(plik)) {
        nastepne.delete(plik);
      } else {
        nastepne.add(plik);
      }
      return nastepne;
    });
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
            latach 2011, 2015, 2019 i 2023. Rozwiń podsumowanie albo dotknij pobierania, aby wziąć
            PDF.
          </ThemedText>
        </View>

        {LATA_PROGRAMOW.map((rok) => (
          <View key={rok} style={styles.yearSection}>
            <ThemedText themeColor="accentLight" style={styles.kicker}>
              Wybory {rok}
            </ThemedText>

            <View style={styles.cards}>
              {programyZRoku(rok).map((program) => {
                const otwarty = rozwiniete.has(program.plik);
                const maPodsumowanie = Boolean(program.podsumowanie);
                return (
                  <View
                    key={program.plik}
                    style={[
                      styles.card,
                      { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                    ]}>
                    <View style={styles.cardTop}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          maPodsumowanie
                            ? `${otwarty ? 'Zwiń' : 'Rozwiń'} podsumowanie: ${program.partia}, ${program.tytul}`
                            : `Pobierz PDF: ${program.partia}, ${program.tytul}, ${program.rozmiar}`
                        }
                        accessibilityState={maPodsumowanie ? { expanded: otwarty } : undefined}
                        onPress={() =>
                          maPodsumowanie ? przelaczPodsumowanie(program.plik) : openProgram(program)
                        }
                        style={({ pressed }) => [styles.cardTexts, pressed && styles.dimmed]}>
                        <ThemedText style={styles.cardParty}>{program.partia}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {program.tytul}
                        </ThemedText>
                        {program.uwaga ? (
                          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                            {program.uwaga}
                          </ThemedText>
                        ) : null}
                        {maPodsumowanie ? (
                          <View style={styles.toggleRow}>
                            <ThemedText
                              type="small"
                              themeColor="accentLight"
                              style={styles.toggleLabel}>
                              Podsumowanie
                            </ThemedText>
                            <Ionicons
                              name={otwarty ? 'chevron-up' : 'chevron-down'}
                              size={14}
                              color={theme.accentLight}
                            />
                          </View>
                        ) : null}
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Pobierz PDF: ${program.partia}, ${program.tytul}, ${program.rozmiar}`}
                        onPress={() => openProgram(program)}
                        hitSlop={Spacing.two}
                        style={({ pressed }) => [styles.download, pressed && styles.dimmed]}>
                        <Ionicons name="download-outline" size={18} color={theme.teal} />
                        <ThemedText type="small" themeColor="textSecondary">
                          {program.rozmiar}
                        </ThemedText>
                      </Pressable>
                    </View>

                    {otwarty && program.podsumowanie ? (
                      <View style={[styles.summary, { borderTopColor: theme.border }]}>
                        {(
                          [
                            ['Najważniejsze postulaty', 'textSecondary', program.podsumowanie.streszczenie],
                            ['Co podchwycić', 'teal', program.podsumowanie.podchwycic],
                            ['Gdzie uderzyć', 'error', program.podsumowanie.uderzyc],
                          ] as [string, ThemeColor, string][]
                        ).map(([etykieta, kolor, tekst]) => (
                          <View key={etykieta} style={styles.summaryBlock}>
                            <ThemedText type="small" themeColor={kolor} style={styles.summaryLabel}>
                              {etykieta}
                            </ThemedText>
                            <ThemedText type="small" themeColor="text80">
                              {tekst}
                            </ThemedText>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
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
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  toggleLabel: {
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  download: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  summary: {
    borderTopWidth: 1,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  summaryBlock: {
    gap: Spacing.one,
  },
  summaryLabel: {
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  dimmed: {
    opacity: 0.7,
  },
});
