import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { EyeDot } from '@/components/eye-dot';
import { ThemedText } from '@/components/themed-text';
import { track } from '@/lib/analytics/posthog';
import { getDailyBrief } from '@/lib/api/daily-brief';
import { buildAssistantSuggestions, FALLBACK_SUGGESTIONS } from '@/lib/assistant-suggestions';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Karta „Zapytaj Argusa" na Pulpicie: pole pytania do asystenta AI plus
 * propozycje pytań na dziś, budowane z briefu dnia. Wysłanie pytania
 * (własnego albo z propozycji) przenosi na ekran rozmowy /asystent-argus.
 */
export function AskArgusCard() {
  const theme = useTheme();
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>(FALLBACK_SUGGESTIONS);

  // Brief dnia raz na montaż: propozycje mają się nie przeładowywać przy
  // każdym powrocie na zakładkę, a błąd pobrania degraduje do zestawu ogólnego.
  useEffect(() => {
    let active = true;
    getDailyBrief()
      .then(({ brief }) => {
        if (active) setSuggestions(buildAssistantSuggestions(brief));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const openAssistant = (text: string, source: 'pulpit_input' | 'pulpit_suggestion') => {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return;
    }
    track('assistant_question_asked', { source });
    setQuestion('');
    // `ts` odróżnia kolejne wejścia z tym samym pytaniem: parametry zakładki
    // trwają na trasie, a ekran wysyła pytanie tylko dla nowego klucza.
    router.push({ pathname: '/asystent-argus', params: { q: trimmed, ts: String(Date.now()) } });
  };

  const canSend = question.trim().length > 0;

  return (
    <View
      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.header}>
        <EyeDot size={12} />
        <ThemedText style={styles.title}>Zapytaj Argusa</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Twój asystent AI zna Twój profil i dzisiejszy przegląd dnia. Zapytaj o przekaz, ryzyko
        albo bieżące wydarzenia.
      </ThemedText>

      <View style={styles.inputRow}>
        <TextInput
          value={question}
          onChangeText={setQuestion}
          placeholder="Zadaj pytanie"
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.input,
            { backgroundColor: theme.background, borderColor: theme.border, color: theme.text },
          ]}
          returnKeyType="send"
          onSubmitEditing={() => openAssistant(question, 'pulpit_input')}
          accessibilityLabel="Pytanie do asystenta Argusa"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Wyślij pytanie do Argusa"
          disabled={!canSend}
          onPress={() => openAssistant(question, 'pulpit_input')}
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

      <View style={styles.suggestions}>
        <ThemedText type="small" themeColor="textSecondary">
          Propozycje na dziś
        </ThemedText>
        {suggestions.map((suggestion) => (
          <Pressable
            key={suggestion}
            accessibilityRole="button"
            onPress={() => openAssistant(suggestion, 'pulpit_suggestion')}
            style={({ pressed }) => [
              styles.suggestion,
              {
                borderColor: theme.border,
                backgroundColor: pressed ? theme.backgroundSelected : theme.background,
              },
            ]}>
            <ThemedText type="small" themeColor="accentLight" style={styles.suggestionText}>
              {suggestion}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    fontFamily: FontFamily.sansSemiBold,
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: FontFamily.sans,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestions: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  suggestion: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  suggestionText: {
    lineHeight: 18,
  },
  dimmed: {
    opacity: 0.7,
  },
});
