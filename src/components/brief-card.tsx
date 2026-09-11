import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { EyeDot } from '@/components/eye-dot';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listBriefs, type BriefListItem } from '@/lib/api/brief';

/**
 * Karta briefu przedwywiadowego na Pulpicie.
 *
 * Po co ona jest: brief przedwywiadowy to serce MVP i north star produktu,
 * a przez pierwsze tygodnie pilotażu powstał dokładnie jeden. Asystent w tym
 * samym czasie zebrał ponad sto wiadomości. Różnica nie leżała w wartości
 * tych funkcji, tylko w drodze do nich. Asystent ma na Pulpicie kartę z polem
 * do pisania, czyli zero kliknięć. Brief był czwarty w kolejności: zakładka
 * Analizy, druga z sześciu kart, lista, dopiero potem „Nowy brief".
 *
 * Ta karta wyrównuje te drogi. Wpisany temat leci parametrem do formularza,
 * zamiast od razu odpalać generację: brief kosztuje około minuty pracy modelu
 * i wypada zapytać jeszcze o rozmówcę, zanim się go zamówi.
 */
export function BriefCard() {
  const theme = useTheme();
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [ostatni, setOstatni] = useState<BriefListItem | null>(null);

  useEffect(() => {
    let active = true;
    listBriefs()
      .then((briefy) => {
        if (active && briefy.length > 0) setOstatni(briefy[0]);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const otworzFormularz = () => {
    const temat = topic.trim();
    setTopic('');
    router.push({
      pathname: '/brief/new',
      params: { from: 'pulpit', ...(temat ? { topic: temat } : {}) },
    });
  };

  return (
    <View
      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.header}>
        <EyeDot size={12} />
        <ThemedText style={styles.title}>Brief przedwywiadowy</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Masz umówiony wywiad? Podaj temat, a Argus przygotuje profil rozmówcy, przewidywane
        pytania, rekomendowane odpowiedzi i pułapki.
      </ThemedText>

      <View style={styles.inputRow}>
        <TextInput
          value={topic}
          onChangeText={setTopic}
          placeholder="Temat rozmowy"
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.input,
            { backgroundColor: theme.background, borderColor: theme.border, color: theme.text },
          ]}
          returnKeyType="next"
          onSubmitEditing={otworzFormularz}
          accessibilityLabel="Temat rozmowy do briefu przedwywiadowego"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Przygotuj brief przedwywiadowy"
          onPress={otworzFormularz}
          style={({ pressed }) => [
            styles.sendButton,
            { backgroundColor: theme.cta },
            pressed && styles.dimmed,
          ]}>
          <Ionicons name="arrow-forward" size={20} color={theme.onAccent} />
        </Pressable>
      </View>

      {ostatni ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Otwórz ostatni brief: ${ostatni.topic}`}
          onPress={() => router.push(`/brief/${ostatni.id}`)}
          style={({ pressed }) => [
            styles.ostatni,
            {
              borderColor: theme.border,
              backgroundColor: pressed ? theme.backgroundSelected : theme.background,
            },
          ]}>
          <ThemedText type="small" themeColor="textSecondary">
            Ostatni brief
          </ThemedText>
          <ThemedText type="small" themeColor="accentLight" style={styles.ostatniTytul}>
            {ostatni.topic}
          </ThemedText>
        </Pressable>
      ) : null}
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
  ostatni: {
    borderWidth: 1,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: 2,
    marginTop: Spacing.one,
  },
  ostatniTytul: {
    lineHeight: 18,
  },
  dimmed: {
    opacity: 0.7,
  },
});
