import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackLink } from '@/components/back-link';
import { FormTextInput } from '@/components/form-text-input';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, FontSize, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { track } from '@/lib/analytics/posthog';
import { createDossier } from '@/lib/api/opponents';

const NAME_MIN_LENGTH = 5;

/**
 * Nowa teczka oponenta. Poza imieniem i nazwiskiem wszystko jest opcjonalne,
 * ale funkcja i partia rozróżniają imienników w wyszukiwaniu, więc formularz
 * o nie prosi. Z briefu przychodzimy z wypełnionym imieniem, klubem i mp_id.
 */
export default function NewOpponentScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string; party?: string; mp_id?: string }>();

  const [fullName, setFullName] = useState(params.name ?? '');
  const [roleHint, setRoleHint] = useState(params.mp_id ? 'poseł na Sejm RP' : '');
  const [party, setParty] = useState(params.party ?? '');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mpId = params.mp_id ? Number(params.mp_id) : undefined;
  const canSubmit = fullName.trim().length >= NAME_MIN_LENGTH && !submitting;

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { id } = await createDossier({
        full_name: fullName.trim(),
        role_hint: roleHint.trim() || undefined,
        party: party.trim() || undefined,
        notes: notes.trim() || undefined,
        mp_id: Number.isFinite(mpId) ? mpId : undefined,
      });
      track('opponent_dossier_created', {
        z_briefu: Boolean(params.name),
        posel: Number.isFinite(mpId),
      });
      router.replace(`/oponenci/${id}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Nie udało się założyć teczki.'
      );
      setSubmitting(false);
    }
  }, [fullName, mpId, notes, params.name, party, roleHint, router]);

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.six },
        ]}>
        <BackLink />

        <View style={styles.header}>
          <ThemedText style={styles.title}>Nowa teczka oponenta</ThemedText>
          <ThemedText themeColor="textSecondary">
            Argus przeszuka sieć pod kątem wypowiedzi tej osoby z ostatniego roku: wywiady,
            kontrowersje, wpisy opisane w mediach, zgodność z programem partii i późniejsze fakty.
          </ThemedText>
        </View>

        <FormTextInput
          label="Imię i nazwisko"
          value={fullName}
          onChangeText={setFullName}
          placeholder="np. Michał Wawer"
          autoCapitalize="words"
        />
        <FormTextInput
          label="Funkcja lub rola (zalecane)"
          value={roleHint}
          onChangeText={setRoleHint}
          placeholder="np. poseł, rzecznik partii, europoseł"
        />
        <FormTextInput
          label="Partia lub klub (zalecane)"
          value={party}
          onChangeText={setParty}
          placeholder="np. Konfederacja"
        />
        <FormTextInput
          label="Wskazówki do identyfikacji (opcjonalnie)"
          value={notes}
          onChangeText={setNotes}
          placeholder="np. nie mylić z prezesem spółki o tym samym nazwisku"
          multiline
        />

        <View style={[styles.note, { borderLeftColor: theme.teal }]}>
          <ThemedText type="small" themeColor="text80">
            Przygotowanie trwa od trzech do sześciu minut. Funkcja i partia pomagają odsiać
            imienników. Każdą wypowiedź przed użyciem na antenie sprawdź w podanym źródle.
          </ThemedText>
        </View>

        {error ? (
          <ThemedText type="small" themeColor="error">
            {error}
          </ThemedText>
        ) : null}

        <PrimaryButton
          title="Przygotuj teczkę"
          onPress={() => void handleSubmit()}
          loading={submitting}
          disabled={!canSubmit}
        />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  header: { gap: Spacing.two },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.screenTitle,
    lineHeight: FontSize.screenTitle * 1.25,
  },
  note: { borderLeftWidth: 2, paddingLeft: Spacing.three, paddingVertical: Spacing.two },
});
