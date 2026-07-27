import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DailyBriefView } from '@/components/daily-brief-view';
import { EyeDot } from '@/components/eye-dot';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
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
  generateBriefTweets,
  generateDailyBrief,
  getDailyBrief,
  type DailyBrief,
  type TweetIdea,
} from '@/lib/api/daily-brief';
import { formatWeekday } from '@/lib/format-time';

/**
 * Brief poranny: syntetyczny przegląd dnia w polityce pod strategię polityka
 * plus pomysły na wpisy na X. Dane z `argus-morning-brief`.
 *
 * Świadomie bez wykresów i liczników zasięgu. To nie dashboard monitoringu,
 * tylko przegląd tego, na co ktoś dziś zapyta, z warstwą „co to znaczy dla Ciebie”.
 */
export default function MorningBriefScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Przegląd dnia (synteza).
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(true);
  const [briefGenerating, setBriefGenerating] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);

  // Pomysły na tweety (X) z briefu: efemeryczne, generowane na żądanie.
  const [tweets, setTweets] = useState<TweetIdea[] | null>(null);
  const [tweetsLoading, setTweetsLoading] = useState(false);
  const [tweetsError, setTweetsError] = useState<string | null>(null);
  const [copiedTweet, setCopiedTweet] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    track('morning_brief_read');
    getDailyBrief()
      .then((result) => {
        if (!active) return;
        setBrief(result.brief);
        setBriefError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setBriefError(err instanceof Error ? err.message : 'Nie udało się pobrać przeglądu dnia.');
      })
      .finally(() => {
        if (active) setBriefLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleGenerateBrief = useCallback(async () => {
    setBriefGenerating(true);
    setBriefError(null);
    try {
      await generateDailyBrief();
      track('morning_brief_generated');
      const result = await getDailyBrief();
      setBrief(result.brief);
    } catch (err) {
      setBriefError(err instanceof Error ? err.message : 'Nie udało się wygenerować przeglądu dnia.');
    } finally {
      setBriefGenerating(false);
    }
  }, []);

  const handleGenerateTweets = useCallback(async () => {
    setTweetsLoading(true);
    setTweetsError(null);
    try {
      const result = await generateBriefTweets();
      track('brief_tweets_generated', { count: result.tweets.length });
      setTweets(result.tweets);
    } catch (err) {
      setTweetsError(err instanceof Error ? err.message : 'Nie udało się wygenerować tweetów.');
    } finally {
      setTweetsLoading(false);
    }
  }, []);

  const handleCopyTweet = useCallback(async (index: number, text: string) => {
    await Clipboard.setStringAsync(text);
    track('brief_tweet_copied');
    setCopiedTweet(index);
    setTimeout(() => setCopiedTweet((current) => (current === index ? null : current)), 1500);
  }, []);

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.six },
        ]}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Wróć"
            onPress={() => router.back()}
            style={styles.iconButton}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.header}>
          <View style={styles.kickerRow}>
            <EyeDot size={8} />
            <ThemedText themeColor="accentLight" style={styles.kicker}>
              {formatWeekday(new Date())}
            </ThemedText>
          </View>
          <ThemedText style={styles.title}>Brief poranny</ThemedText>
          <ThemedText themeColor="textSecondary">
            Najważniejsze wydarzenia dnia w polskiej polityce, zebrane pod Twoją strategię, oraz
            gotowe pomysły na wpisy na X.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <ThemedText style={styles.sectionTitle}>Przegląd dnia</ThemedText>
            {brief?.status === 'ready' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Odśwież przegląd dnia"
                onPress={handleGenerateBrief}
                disabled={briefGenerating}>
                {briefGenerating ? (
                  <ActivityIndicator size="small" color={theme.accent} />
                ) : (
                  <ThemedText type="small" themeColor="accentLight">
                    Odśwież
                  </ThemedText>
                )}
              </Pressable>
            ) : null}
          </View>

          {briefError ? (
            <View style={[styles.alert, { borderLeftColor: theme.error }]}>
              <ThemedText type="small">{briefError}</ThemedText>
            </View>
          ) : null}

          {briefLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={theme.accent} />
            </View>
          ) : brief && brief.status === 'ready' ? (
            <DailyBriefView brief={brief} />
          ) : brief && brief.status === 'generating' ? (
            <View style={styles.centered}>
              <ActivityIndicator color={theme.accent} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
                Przygotowuję przegląd dnia. To potrwa chwilę.
              </ThemedText>
            </View>
          ) : (
            <View style={styles.briefEmpty}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
                {brief?.status === 'error'
                  ? 'Ostatnia próba przygotowania przeglądu nie powiodła się.'
                  : 'Nie ma jeszcze przeglądu na dziś.'}
              </ThemedText>
              <PrimaryButton
                title={briefGenerating ? 'Generuję...' : 'Wygeneruj przegląd'}
                onPress={handleGenerateBrief}
                disabled={briefGenerating}
              />
            </View>
          )}
        </View>

        {brief?.status === 'ready' ? (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <ThemedText style={styles.sectionTitle}>Pomysły na tweety</ThemedText>
              {tweets ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Wygeneruj nowe tweety"
                  onPress={handleGenerateTweets}
                  disabled={tweetsLoading}>
                  {tweetsLoading ? (
                    <ActivityIndicator size="small" color={theme.accent} />
                  ) : (
                    <ThemedText type="small" themeColor="accentLight">
                      Nowe
                    </ThemedText>
                  )}
                </Pressable>
              ) : null}
            </View>

            {tweetsError ? (
              <View style={[styles.alert, { borderLeftColor: theme.error }]}>
                <ThemedText type="small">{tweetsError}</ThemedText>
              </View>
            ) : null}

            {tweets === null ? (
              <View style={styles.briefEmpty}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
                  Z dzisiejszego przeglądu podpowiem, o czym napisać na X i w co uderzyć.
                </ThemedText>
                <PrimaryButton
                  title={tweetsLoading ? 'Generuję...' : 'Pomysły na tweety'}
                  onPress={handleGenerateTweets}
                  disabled={tweetsLoading}
                />
              </View>
            ) : tweets.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Brak pomysłów: dzisiejszy przegląd jest pusty.
              </ThemedText>
            ) : (
              tweets.map((tweet, index) => (
                <ThemedView
                  key={`${tweet.wydarzenie}-${index}`}
                  type="backgroundElement"
                  style={[styles.tweetCard, { borderColor: theme.border }]}>
                  <ThemedText type="small" themeColor="teal" style={styles.tweetEvent}>
                    {tweet.wydarzenie}
                  </ThemedText>
                  <ThemedText style={styles.tweetTopic}>{tweet.temat}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    <ThemedText type="smallBold">W co uderzyć: </ThemedText>
                    {tweet.w_co_uderzyc}
                  </ThemedText>
                  <View style={styles.tweetFooter}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Kopiuj pomysł"
                      onPress={() =>
                        handleCopyTweet(index, `${tweet.temat}\n\nW co uderzyć: ${tweet.w_co_uderzyc}`)
                      }
                      hitSlop={8}>
                      <ThemedText type="small" themeColor="accentLight">
                        {copiedTweet === index ? 'Skopiowano' : 'Kopiuj pomysł'}
                      </ThemedText>
                    </Pressable>
                  </View>
                </ThemedView>
              ))
            )}
          </View>
        ) : null}
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: Spacing.one,
  },
  header: {
    gap: Spacing.two,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  kicker: {
    ...KickerStyle,
  },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.screenTitle,
    lineHeight: FontSize.screenTitle * 1.25,
  },
  section: {
    gap: Spacing.three,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  sectionTitle: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.section,
    lineHeight: FontSize.section * 1.3,
  },
  briefEmpty: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.four,
  },
  tweetCard: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  tweetEvent: {
    fontFamily: FontFamily.sansSemiBold,
  },
  tweetTopic: {
    fontFamily: FontFamily.sansSemiBold,
  },
  tweetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  alert: {
    borderLeftWidth: 2,
    borderRadius: Radius.small,
    padding: Spacing.three,
  },
  centered: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.six,
  },
  centeredText: {
    textAlign: 'center',
  },
});
