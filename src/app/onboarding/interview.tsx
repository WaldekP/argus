import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { SkipStepLink } from '@/components/skip-step-link';
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
import { interviewTurn } from '@/lib/api/onboarding';
import { setStatus } from '@/store/onboarding';

type ChatMessage = {
  id: number;
  role: 'ai' | 'user';
  text: string;
};

export default function InterviewScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [progress, setProgress] = useState(0);
  // sending startuje jako true: pierwsze pytanie pobieramy od razu po wejściu.
  const [sending, setSending] = useState(true);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const nextIdRef = useRef(1);
  // Ostatnia wysłana odpowiedź, do ponowienia po błędzie.
  const lastAnswerRef = useRef<string | undefined>(undefined);

  // Bez synchronicznych setState przed pierwszym await: stany ustawiają
  // wywołujący (event handlery), a efekt startowy korzysta ze stanu początkowego.
  const runTurn = useCallback(
    async (answer?: string) => {
      lastAnswerRef.current = answer;
      try {
        const result = await interviewTurn(answer);
        setError(null);
        setProgress(result.progress);
        if (result.question) {
          setMessages((current) => [
            ...current,
            { id: nextIdRef.current++, role: 'ai', text: result.question as string },
          ]);
        }
        if (result.done) {
          setStatus('style');
          router.replace('/onboarding/style');
        }
      } catch (turnError) {
        setError(
          turnError instanceof Error ? turnError.message : 'Nie udało się połączyć z Argusem.'
        );
      } finally {
        setSending(false);
        setStarting(false);
      }
    },
    [router]
  );

  const startedRef = useRef(false);

  // Pierwsze pytanie (lub wznowienie wywiadu) przy wejściu na ekran.
  useEffect(() => {
    if (!startedRef.current && starting) {
      startedRef.current = true;
      void runTurn();
    }
  }, [runTurn, starting]);

  const handleSend = () => {
    const answer = draft.trim();
    if (!answer || sending) {
      return;
    }
    setMessages((current) => [...current, { id: nextIdRef.current++, role: 'user', text: answer }]);
    setDraft('');
    setError(null);
    setSending(true);
    void runTurn(answer);
  };

  const handleRetry = () => {
    setError(null);
    setSending(true);
    void runTurn(lastAnswerRef.current);
  };

  // Żaden krok onboardingu nie jest obowiązkowy: pominięcie idzie do stylu.
  const handleSkipStep = () => {
    setStatus('style');
    router.replace('/onboarding/style');
  };

  const canSend = draft.trim().length > 0 && !sending;

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.container, { paddingTop: insets.top + Spacing.four }]}>
          <View style={styles.header}>
            <ThemedText themeColor="accent" style={styles.kicker}>
              Krok 2 z 4
            </ThemedText>
            <ThemedText style={styles.title}>Wywiad założycielski</ThemedText>
            <View style={[styles.progressTrack, { backgroundColor: theme.progressTrack }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: theme.accent,
                    width: `${Math.round(Math.min(Math.max(progress, 0), 1) * 100)}%`,
                  },
                ]}
              />
            </View>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.chat}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled">
            {starting ? (
              <View style={styles.loading}>
                <ActivityIndicator color={theme.accent} />
                <ThemedText type="small" themeColor="textSecondary">
                  Argus przygotowuje pierwsze pytanie.
                </ThemedText>
              </View>
            ) : null}

            {messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.bubble,
                  message.role === 'ai'
                    ? [styles.bubbleAi, { backgroundColor: theme.backgroundSelected }]
                    : [
                        styles.bubbleUser,
                        { backgroundColor: theme.backgroundElement, borderColor: theme.borderStrong },
                      ],
                ]}>
                <ThemedText themeColor={message.role === 'ai' ? 'text80' : 'text'}>
                  {message.text}
                </ThemedText>
              </View>
            ))}

            {sending && !starting ? (
              <View style={styles.loading}>
                <ActivityIndicator color={theme.accent} />
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorBox}>
                <ThemedText type="small" themeColor="error" style={styles.centered}>
                  {error}
                </ThemedText>
                <PrimaryButton title="Spróbuj ponownie" variant="secondary" onPress={handleRetry} />
              </View>
            ) : null}
          </ScrollView>

          <View
            style={[
              styles.inputRow,
              {
                borderTopColor: theme.border,
                paddingBottom: insets.bottom + Spacing.three,
              },
            ]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Twoja odpowiedź"
              placeholderTextColor={theme.textSecondary}
              multiline
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Wyślij odpowiedź"
              onPress={handleSend}
              disabled={!canSend}
              style={({ pressed }) => [
                styles.sendButton,
                { backgroundColor: theme.cta },
                (!canSend || pressed) && styles.dimmed,
              ]}>
              <Ionicons name="arrow-up" size={20} color={theme.onAccent} />
            </Pressable>
          </View>
          <SkipStepLink title="Pomiń wywiad" onPress={handleSkipStep} />
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
  },
  header: {
    gap: Spacing.two,
    paddingBottom: Spacing.three,
  },
  kicker: {
    ...KickerStyle,
  },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.screenTitle,
    lineHeight: FontSize.screenTitle * 1.25,
  },
  progressTrack: {
    height: 6,
    borderRadius: Radius.full,
    overflow: 'hidden',
    marginTop: Spacing.one,
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  chat: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  loading: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: Radius.card,
    padding: Spacing.three,
  },
  bubbleAi: {
    alignSelf: 'flex-start',
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    borderWidth: 1,
  },
  errorBox: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  centered: {
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    borderTopWidth: 1,
    paddingTop: Spacing.two,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: FontFamily.sans,
    maxHeight: 120,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: {
    opacity: 0.6,
  },
});
