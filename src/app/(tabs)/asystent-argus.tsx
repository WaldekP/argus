import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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

import { EyeDot } from '@/components/eye-dot';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, FontSize, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { track } from '@/lib/analytics/posthog';
import {
  getConversation,
  streamAssistantAnswer,
  type AssistantMessage,
} from '@/lib/api/assistant';

/**
 * Zakładka Asystent Argus (centralny przycisk dolnego menu, trasa
 * /asystent-argus). Odpowiedź strumieniuje się do ostatniego dymka.
 *
 * Rozmowy są trwałe (baza, Edge Function argus-assistant): id wątku siedzi
 * w parametrze `cid` trasy, historia rozmów pod /asystent/rozmowy. Wejścia:
 *   - karta „Zapytaj Argusa" na Pulpicie: `q` + `ts` (nowa rozmowa),
 *   - historia rozmów: `cid` (wczytanie wątku z bazy).
 * Projekt: docs/superpowers/specs/2026-07-27-asystent-argus-design.md
 */
export default function AssistantScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; ts?: string; cid?: string }>();

  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** Ostatnie pytanie bez odpowiedzi, do ponowienia po błędzie. */
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const mountedRef = useRef(true);
  /** Id wątku w refie: onMeta strumienia musi być widoczne synchronicznie. */
  const conversationIdRef = useRef<string | null>(null);
  /** Klucz ostatnio obsłużonego pytania z Pulpitu (parametry trwają na trasie). */
  const handledParamRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setConversation = (id: string | null) => {
    conversationIdRef.current = id;
  };

  const send = async (
    raw: string,
    opts?: { newConversation?: boolean; appendUser?: boolean }
  ) => {
    const question = raw.trim();
    if (question.length === 0 || thinking) {
      return;
    }
    if (opts?.newConversation) {
      setConversation(null);
      setMessages([]);
    }
    setPendingQuestion(question);
    setThinking(true);
    setError(null);
    if (opts?.appendUser !== false) {
      setMessages((current) => [...current, { role: 'user', content: question }]);
    }
    // Pusty dymek asystenta: strumień dokleja do niego kolejne fragmenty.
    setMessages((current) => [...current, { role: 'assistant', content: '' }]);

    try {
      await streamAssistantAnswer(
        question,
        opts?.newConversation ? null : conversationIdRef.current,
        {
          onMeta: (id) => {
            setConversation(id);
            // Id wątku w URL: rozmowę można otworzyć ponownie z historii.
            router.setParams({ cid: id });
          },
          onDelta: (text) => {
            if (!mountedRef.current) {
              return;
            }
            setMessages((current) => {
              const next = [...current];
              const last = next[next.length - 1];
              if (last?.role === 'assistant') {
                next[next.length - 1] = { ...last, content: last.content + text };
              }
              return next;
            });
          },
        }
      );
      if (mountedRef.current) {
        setPendingQuestion(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        // Pusty dymek po nieudanym starcie zdejmujemy; częściową odpowiedź zostawiamy.
        setMessages((current) => {
          const last = current[current.length - 1];
          if (last?.role === 'assistant' && last.content.length === 0) {
            return current.slice(0, -1);
          }
          return current;
        });
        setError(err instanceof Error ? err.message : 'Nie udało się uzyskać odpowiedzi.');
      }
    } finally {
      if (mountedRef.current) {
        setThinking(false);
      }
    }
  };

  // Pytanie z Pulpitu: nowa rozmowa, wysyłka raz na wejście (`ts` odróżnia
  // kolejne wejścia z tym samym pytaniem).
  useEffect(() => {
    const initial = typeof params.q === 'string' ? params.q.trim() : '';
    const key = `${typeof params.ts === 'string' ? params.ts : ''}:${initial}`;
    if (initial.length > 0 && handledParamRef.current !== key && !thinking) {
      handledParamRef.current = key;
      void send(initial, { newConversation: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q, params.ts]);

  // Wątek z historii rozmów: wczytujemy z bazy, o ile to nie bieżąca rozmowa.
  useEffect(() => {
    const cid = typeof params.cid === 'string' ? params.cid : '';
    if (!cid || cid === conversationIdRef.current || thinking) {
      return;
    }
    let active = true;
    getConversation(cid)
      .then(({ conversation, messages: loaded }) => {
        if (!active || !mountedRef.current) {
          return;
        }
        setConversation(conversation.id);
        setMessages(loaded);
        setError(null);
      })
      .catch((err) => {
        if (active && mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Nie udało się wczytać rozmowy.');
        }
      });
    return () => {
      active = false;
    };
  }, [params.cid, thinking]);

  const handleSend = () => {
    const question = input.trim();
    if (question.length === 0 || thinking) {
      return;
    }
    setInput('');
    track('assistant_question_asked', { source: 'chat' });
    void send(question);
  };

  const handleRetry = () => {
    const question = pendingQuestion;
    if (!question) {
      return;
    }
    // Pytanie usera wciąż wisi na końcu listy, więc nie doklejamy go drugi raz.
    const last = messages[messages.length - 1];
    void send(question, {
      appendUser: !(last?.role === 'user' && last.content === question),
    });
  };

  const handleNewConversation = () => {
    if (thinking) {
      return;
    }
    setConversation(null);
    setMessages([]);
    setError(null);
    setPendingQuestion(null);
    router.setParams({ cid: '', q: '', ts: '' });
  };

  const canSend = input.trim().length > 0 && !thinking;

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.column, { paddingTop: insets.top + Spacing.four }]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <ThemedText style={styles.title}>Asystent Argus</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Zna Twój profil, styl i dzisiejszy przegląd dnia. Nie zmyśla liczb ani cytatów.
              </ThemedText>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Nowa rozmowa"
                onPress={handleNewConversation}
                style={({ pressed }) => [
                  styles.headerAction,
                  {
                    backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
                    borderColor: theme.border,
                  },
                ]}>
                <Ionicons name="add" size={20} color={theme.accent} />
                <ThemedText type="small" themeColor="accent" style={styles.headerActionLabel}>
                  Nowa rozmowa
                </ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Historia rozmów"
                onPress={() => router.push('/asystent/rozmowy')}
                style={({ pressed }) => [
                  styles.headerAction,
                  {
                    backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
                    borderColor: theme.border,
                  },
                ]}>
                <Ionicons name="time-outline" size={20} color={theme.accent} />
                <ThemedText type="small" themeColor="accent" style={styles.headerActionLabel}>
                  Historia
                </ThemedText>
              </Pressable>
            </View>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.messages}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled">
            {messages.length === 0 && !thinking ? (
              <View style={styles.emptyState}>
                <Ionicons name="eye-outline" size={40} color={theme.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  Zadaj pytanie, a Argus odpowie na podstawie Twojego profilu i dzisiejszego
                  przeglądu dnia.
                </ThemedText>
              </View>
            ) : null}

            {messages.map((message, index) => (
              <View
                key={`${message.role}-${index}`}
                style={[
                  styles.bubble,
                  message.role === 'user'
                    ? [styles.bubbleUser, { backgroundColor: theme.accent }]
                    : [
                        styles.bubbleAssistant,
                        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                      ],
                ]}>
                {message.role === 'assistant' ? (
                  <View style={styles.bubbleHeader}>
                    <EyeDot size={10} />
                    <ThemedText type="small" themeColor="textSecondary">
                      Argus
                    </ThemedText>
                  </View>
                ) : null}
                {message.role === 'assistant' && message.content.length === 0 ? (
                  <View style={styles.thinkingRow}>
                    <ActivityIndicator size="small" color={theme.accent} />
                    <ThemedText type="small" themeColor="textSecondary">
                      Argus analizuje
                    </ThemedText>
                  </View>
                ) : (
                  <ThemedText themeColor={message.role === 'user' ? 'onAccent' : 'text'}>
                    {message.content}
                  </ThemedText>
                )}
              </View>
            ))}

            {error ? (
              <View style={styles.errorBlock}>
                <ThemedText type="small" themeColor="error">
                  {error}
                </ThemedText>
                {pendingQuestion ? (
                  <PrimaryButton
                    title="Spróbuj ponownie"
                    variant="secondary"
                    onPress={handleRetry}
                  />
                ) : null}
              </View>
            ) : null}
          </ScrollView>

          <View style={[styles.inputRow, { borderTopColor: theme.border }]}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Zadaj pytanie"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              multiline
              accessibilityLabel="Pytanie do asystenta Argusa"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Wyślij pytanie"
              disabled={!canSend}
              onPress={handleSend}
              style={({ pressed }) => [
                styles.sendButton,
                { backgroundColor: canSend ? theme.cta : theme.backgroundSelected },
                pressed && styles.dimmed,
              ]}>
              <Ionicons
                name="arrow-up"
                size={20}
                color={canSend ? theme.onAccent : theme.textSecondary}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingBottom: Spacing.three,
  },
  headerText: {
    flex: 1,
    gap: Spacing.two,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  // Pigułki jak chipy z design systemu: obrys, pełny radius, cel dotyku 44 px.
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.full,
  },
  headerActionLabel: {
    fontFamily: FontFamily.sansSemiBold,
  },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.screenTitle,
    lineHeight: FontSize.screenTitle * 1.25,
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.six,
  },
  emptyText: {
    textAlign: 'center',
    maxWidth: 320,
  },
  bubble: {
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.two,
    maxWidth: '90%',
  },
  bubbleUser: {
    alignSelf: 'flex-end',
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  bubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  errorBlock: {
    gap: Spacing.two,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    borderTopWidth: 1,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: FontFamily.sans,
    maxHeight: 120,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: {
    opacity: 0.7,
  },
});
