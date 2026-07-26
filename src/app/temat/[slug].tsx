import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EyeDot } from '@/components/eye-dot';
import { PollBars } from '@/components/knowledge/poll-bars';
import { QuoteCard } from '@/components/knowledge/quote-card';
import { SectionHeading } from '@/components/knowledge/section-heading';
import { SourceLink } from '@/components/knowledge/source-link';
import { PrimaryButton } from '@/components/primary-button';
import { SavedDraftsList } from '@/components/saved-drafts-list';
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
import { znajdzTemat } from '@/lib/knowledge';

type Sekcja = 'opinia' | 'politycy' | 'komunikacja';

const SEKCJE: { value: Sekcja; label: string }[] = [
  { value: 'opinia', label: 'Opinia' },
  { value: 'politycy', label: 'Politycy' },
  { value: 'komunikacja', label: 'Komunikacja' },
];

export default function TopicScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [sekcja, setSekcja] = useState<Sekcja>('opinia');
  const [otwartyPolityk, setOtwartyPolityk] = useState<string | null>(null);

  const temat = znajdzTemat(slug ?? '');

  if (!temat) {
    return (
      <ThemedView style={styles.missing}>
        <ThemedText>Nie znam takiego tematu.</ThemedText>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <ThemedText themeColor="accentLight">Wróć</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.three, paddingBottom: BottomTabInset + Spacing.six },
        ]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Wróć do listy tematów"
          onPress={() => router.back()}
          style={styles.back}>
          <Ionicons name="chevron-back" size={18} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary">
            Tematy
          </ThemedText>
        </Pressable>

        <View style={styles.header}>
          <ThemedText style={styles.title}>{temat.nazwa}</ThemedText>
          <ThemedText themeColor="textSecondary">{temat.zajawka}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {temat.liczbaZrodel} źródeł, aktualizacja {temat.aktualizacja}
          </ThemedText>
        </View>

        {/* Rekomendacja: pierwsza rzecz na ekranie, bo to ona odpowiada na pytanie użytkownika. */}
        <View
          style={[
            styles.recommendation,
            { backgroundColor: theme.backgroundSelected, borderLeftColor: theme.accent },
          ]}>
          <ThemedText themeColor="accentLight" style={styles.kicker}>
            Rekomendacja
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {temat.rekomendacja.pytanie}
          </ThemedText>
          <ThemedText style={styles.recommendationAnswer}>{temat.rekomendacja.odpowiedz}</ThemedText>

          <View style={styles.list}>
            {temat.rekomendacja.uzasadnienie.map((punkt) => (
              <View key={punkt} style={styles.listRow}>
                <EyeDot size={8} style={styles.bullet} />
                <ThemedText type="small" style={styles.listText}>
                  {punkt}
                </ThemedText>
              </View>
            ))}
          </View>

          {/* Dwie warstwy taktyczne: co przejąć i gdzie uderzyć. Opcjonalne. */}
          {temat.rekomendacja.podchwycic?.length ? (
            <View style={[styles.tactic, { borderColor: theme.teal }]}>
              <ThemedText themeColor="teal" style={styles.kicker}>
                Co podchwycić
              </ThemedText>
              {temat.rekomendacja.podchwycic.map((punkt) => (
                <View key={punkt} style={styles.listRow}>
                  <EyeDot size={8} style={styles.bullet} />
                  <ThemedText type="small" style={styles.listText}>
                    {punkt}
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : null}

          {temat.rekomendacja.zaatakowac?.length ? (
            <View style={[styles.tactic, { borderColor: theme.accent }]}>
              <ThemedText themeColor="accentLight" style={styles.kicker}>
                Gdzie uderzyć
              </ThemedText>
              {temat.rekomendacja.zaatakowac.map((punkt) => (
                <View key={punkt} style={styles.listRow}>
                  <EyeDot size={8} style={styles.bullet} />
                  <ThemedText type="small" style={styles.listText}>
                    {punkt}
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : null}

          <View style={[styles.risk, { borderColor: theme.error }]}>
            <ThemedText type="small" themeColor="error" style={styles.riskTitle}>
              Co przemawia przeciw
            </ThemedText>
            {temat.rekomendacja.ryzyko.map((punkt) => (
              <ThemedText key={punkt} type="small" themeColor="textSecondary">
                {punkt}
              </ThemedText>
            ))}
          </View>
        </View>

        {/* Liczby kluczowe */}
        <View style={styles.numbers}>
          {temat.kluczoweLiczby.map((liczba) => (
            <View
              key={liczba.wartosc}
              style={[
                styles.numberCard,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: liczba.doPublikacji ? theme.border : theme.error,
                },
              ]}>
              <ThemedText style={styles.numberValue} themeColor="accentLight">
                {liczba.wartosc}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {liczba.opis}
              </ThemedText>
              {!liczba.doPublikacji ? (
                <ThemedText type="small" themeColor="error">
                  Do weryfikacji, nie publikuj
                </ThemedText>
              ) : null}
            </View>
          ))}
        </View>

        {/* Przełącznik sekcji */}
        <View style={[styles.tabs, { borderColor: theme.border }]}>
          {SEKCJE.map((pozycja) => {
            const aktywna = pozycja.value === sekcja;
            return (
              <Pressable
                key={pozycja.value}
                accessibilityRole="tab"
                accessibilityState={{ selected: aktywna }}
                aria-selected={aktywna}
                onPress={() => {
                  setSekcja(pozycja.value);
                  track('topic_section_viewed', { topic: temat.slug, section: pozycja.value });
                }}
                style={[
                  styles.tab,
                  aktywna && { backgroundColor: theme.backgroundSelected },
                ]}>
                <ThemedText
                  type="small"
                  themeColor={aktywna ? 'accentLight' : 'textSecondary'}>
                  {pozycja.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {sekcja === 'opinia' ? (
          <View style={styles.section}>
            <SectionHeading
              kicker="Synteza"
              title="Co mówi opinia społeczna"
              lead="Wnioski z badań w tym zagadnieniu. Każdy da się sprawdzić w źródle niżej."
            />
            <View style={styles.list}>
              {temat.syntezaOpinii.map((zdanie) => (
                <View key={zdanie} style={styles.listRow}>
                  <EyeDot size={8} style={styles.bullet} />
                  <ThemedText type="small" style={styles.listText}>
                    {zdanie}
                  </ThemedText>
                </View>
              ))}
            </View>

            {temat.badania?.map((badanie) => (
              <View
                key={badanie.id}
                style={[
                  styles.card,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                ]}>
                <ThemedText themeColor="accentLight" style={styles.kicker}>
                  {badanie.instytut}
                </ThemedText>
                <ThemedText style={styles.cardTitle}>{badanie.pytanie}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {badanie.zleceniodawca}, {badanie.termin}, {badanie.proba}
                </ThemedText>

                <PollBars wyniki={badanie.wyniki} />

                <View style={[styles.note, { borderColor: theme.border }]}>
                  <ThemedText themeColor="accentLight" style={styles.kicker}>
                    Jak to czytać
                  </ThemedText>
                  <ThemedText type="small">{badanie.jakCzytac}</ThemedText>
                </View>

                <SourceLink zrodlo={badanie.zrodlo} />
              </View>
            ))}

            {temat.zagranica?.length ? (
              <View style={styles.section}>
                <SectionHeading
                  kicker="Zagranica"
                  title="Jak jest za granicą"
                  lead="Punkt odniesienia ze świata: czy postulat ma odpowiednik i z jakim skutkiem."
                />
                {temat.zagranica.map((kraj) => (
                  <View
                    key={kraj.kraj}
                    style={[
                      styles.card,
                      { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                    ]}>
                    <ThemedText style={styles.cardTitle}>{kraj.kraj}</ThemedText>
                    <ThemedText type="small">{kraj.opis}</ThemedText>
                    {kraj.wniosek ? (
                      <View style={[styles.weakSpot, { borderLeftColor: theme.teal }]}>
                        <ThemedText themeColor="teal" style={styles.kicker}>
                          Wniosek
                        </ThemedText>
                        <ThemedText type="small">{kraj.wniosek}</ThemedText>
                      </View>
                    ) : null}
                    <SourceLink zrodlo={kraj.zrodlo} />
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {sekcja === 'politycy' ? (
          <View style={styles.section}>
            <SectionHeading
              kicker="Punkt odniesienia"
              title="Kto co powiedział"
              lead="Dosłowne cytaty z datą, miejscem i odnośnikiem. Dotknij nazwiska, żeby rozwinąć."
            />

            {temat.politycy.map((polityk) => {
              const otwarty = otwartyPolityk === polityk.id;
              return (
                <View
                  key={polityk.id}
                  style={[
                    styles.card,
                    { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  ]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: otwarty }}
                    accessibilityLabel={`${polityk.imieNazwisko}, ${polityk.wypowiedzi.length} wypowiedzi`}
                    onPress={() => {
                      const next = otwarty ? null : polityk.id;
                      setOtwartyPolityk(next);
                      if (next) {
                        track('topic_politician_viewed', {
                          topic: temat.slug,
                          politician: polityk.id,
                        });
                      }
                    }}
                    style={styles.politicianHeader}>
                    <View style={styles.politicianNames}>
                      <ThemedText style={styles.cardTitle}>{polityk.imieNazwisko}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {polityk.funkcja}, {polityk.ugrupowanie}
                      </ThemedText>
                    </View>
                    <Ionicons
                      name={otwarty ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={theme.textSecondary}
                    />
                  </Pressable>

                  <ThemedText type="small">{polityk.stanowisko}</ThemedText>

                  <View style={[styles.weakSpot, { borderLeftColor: theme.teal }]}>
                    <ThemedText themeColor="teal" style={styles.kicker}>
                      Słaby punkt
                    </ThemedText>
                    <ThemedText type="small">{polityk.slabyPunkt}</ThemedText>
                  </View>

                  {otwarty ? (
                    <View style={styles.quotes}>
                      {polityk.wypowiedzi.map((wypowiedz) => (
                        <QuoteCard key={wypowiedz.id} wypowiedz={wypowiedz} />
                      ))}
                    </View>
                  ) : (
                    <ThemedText type="small" themeColor="accentLight">
                      {polityk.wypowiedzi.length}{' '}
                      {polityk.wypowiedzi.length === 1 ? 'wypowiedź' : 'wypowiedzi'} w tym zagadnieniu
                    </ThemedText>
                  )}
                </View>
              );
            })}
          </View>
        ) : null}

        {sekcja === 'komunikacja' ? (
          <View style={styles.section}>
            <SectionHeading
              kicker="Playbook"
              title="Jak o tym mówić"
              lead="Ten sam temat, inny język do każdej grupy. Podstawa każdego wyboru podana jawnie."
            />

            <View
              style={[
                styles.generateCard,
                { backgroundColor: theme.backgroundSelected, borderLeftColor: theme.accent },
              ]}>
              <ThemedText themeColor="accentLight" style={styles.kicker}>
                Wygeneruj przekaz
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Na podstawie tego zagadnienia przygotuj gotowe warianty treści dla wybranych grup
                wyborców i kanałów, w Twoim stylu. Możesz je zapisać i wrócić do nich później.
              </ThemedText>
              <PrimaryButton
                title="Wygeneruj przekaz"
                onPress={() =>
                  router.push({
                    pathname: '/content/new',
                    params: { topicSlug: temat.slug },
                  })
                }
              />
            </View>

            {temat.segmenty.map((segment) => (
              <View
                key={segment.id}
                style={[
                  styles.card,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                ]}>
                <ThemedText style={styles.cardTitle}>{segment.nazwa}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {segment.opis}
                </ThemedText>

                <View style={[styles.note, { borderColor: theme.border }]}>
                  <ThemedText themeColor="accentLight" style={styles.kicker}>
                    Kąt przekazu
                  </ThemedText>
                  <ThemedText type="small">{segment.kat}</ThemedText>
                </View>

                <ThemedText themeColor="teal" style={styles.kicker}>
                  Co działa
                </ThemedText>
                {segment.coDziala.map((punkt) => (
                  <View key={punkt} style={styles.listRow}>
                    <EyeDot size={8} style={styles.bullet} />
                    <ThemedText type="small" style={styles.listText}>
                      {punkt}
                    </ThemedText>
                  </View>
                ))}

                <ThemedText themeColor="error" style={styles.kicker}>
                  Czego unikać
                </ThemedText>
                {segment.czegoUnikac.map((punkt) => (
                  <ThemedText key={punkt} type="small" themeColor="textSecondary">
                    {punkt}
                  </ThemedText>
                ))}

                <View style={styles.chips}>
                  {segment.kanaly.map((kanal) => (
                    <View key={kanal} style={[styles.chip, { borderColor: theme.borderStrong }]}>
                      <ThemedText type="small" themeColor="accentLight">
                        {kanal}
                      </ThemedText>
                    </View>
                  ))}
                </View>

                <View
                  style={[styles.example, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText themeColor="accentLight" style={styles.kicker}>
                    Przykład sformułowania
                  </ThemedText>
                  <ThemedText style={styles.exampleText}>„{segment.przyklad}”</ThemedText>
                </View>

                <View style={[styles.note, { borderColor: theme.border }]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Podstawa: {segment.podstawa}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Zapisane przekazy tego tematu: zawsze widoczne, niezależnie od sekcji. */}
        <View style={styles.section}>
          <SectionHeading
            kicker="Twoje przekazy"
            title="Zapisane przekazy"
            lead="Warianty wygenerowane z tego tematu. Dotknij, żeby otworzyć."
          />
          <SavedDraftsList
            topicRef={temat.slug}
            emptyText="Nie masz jeszcze przekazu z tego tematu. Użyj przycisku Wygeneruj przekaz w sekcji Komunikacja."
          />
        </View>

        {/* Luki: zawsze widoczne, niezależnie od sekcji. */}
        <View style={[styles.gaps, { borderColor: theme.border }]}>
          <ThemedText themeColor="textSecondary" style={styles.kicker}>
            Czego w tym zagadnieniu nie ma
          </ThemedText>
          {temat.luki.map((luka) => (
            <ThemedText key={luka} type="small" themeColor="textSecondary">
              {luka}
            </ThemedText>
          ))}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
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
  recommendation: {
    borderLeftWidth: 2,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  recommendationAnswer: {
    fontFamily: FontFamily.serif,
    fontSize: 21,
    lineHeight: 30,
  },
  tactic: {
    borderLeftWidth: 2,
    borderRadius: Radius.small,
    paddingLeft: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  risk: {
    borderWidth: 1,
    borderRadius: Radius.small,
    padding: Spacing.two,
    gap: Spacing.one,
  },
  riskTitle: {
    fontFamily: FontFamily.sansSemiBold,
  },
  numbers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  numberCard: {
    flexGrow: 1,
    flexBasis: 220,
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  numberValue: {
    fontFamily: FontFamily.serifBold,
    fontSize: 30,
    lineHeight: 36,
  },
  tabs: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: Radius.full,
    padding: Spacing.half,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.full,
  },
  section: {
    gap: Spacing.three,
  },
  generateCard: {
    borderLeftWidth: 2,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardTitle: {
    fontFamily: FontFamily.serif,
    fontSize: 20,
    lineHeight: 26,
  },
  note: {
    borderTopWidth: 1,
    paddingTop: Spacing.two,
    gap: Spacing.one,
  },
  list: {
    gap: Spacing.two,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  bullet: {
    marginTop: 6,
  },
  listText: {
    flex: 1,
  },
  politicianHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  politicianNames: {
    flex: 1,
    gap: Spacing.half,
  },
  weakSpot: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.two,
    gap: Spacing.one,
  },
  quotes: {
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
  example: {
    borderRadius: Radius.small,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  exampleText: {
    fontFamily: FontFamily.serifItalic,
    fontSize: 18,
    lineHeight: 27,
  },
  gaps: {
    borderTopWidth: 1,
    paddingTop: Spacing.three,
    gap: Spacing.one,
  },
});
