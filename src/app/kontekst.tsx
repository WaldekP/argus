import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackLink } from '@/components/back-link';
import { FormTextInput } from '@/components/form-text-input';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, FontSize, MaxContentWidth, Spacing } from '@/constants/theme';
import { CONTEXT_FIELD_MAX_LENGTH, updateContext } from '@/lib/api/onboarding';
import { setProfile, useOnboardingStore } from '@/store/onboarding';

/** Bezpieczny odczyt pola kontekstu z luźnego profilu. */
function readField(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Edycja ręcznego kontekstu polityka: o kandydacie, o partii, stanowiska
 * wobec tematów. Zapis idzie do politician_profiles (operation update_context),
 * a te same pola Argus wstrzykuje do generacji przekazu.
 */
export default function ContextScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const profile = useOnboardingStore((state) => state.profile);

  const [bio, setBio] = useState(() => readField(profile?.bio));
  const [partyProfile, setPartyProfile] = useState(() => readField(profile?.party_profile));
  const [topicPositions, setTopicPositions] = useState(() =>
    readField(profile?.topic_positions)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateContext({
        bio,
        party_profile: partyProfile,
        topic_positions: topicPositions,
      });
      setProfile(updated);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać kontekstu.');
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four },
        ]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets>
        <BackLink />

        <View style={styles.header}>
          <ThemedText style={styles.title}>Kontekst dla Argusa</ThemedText>
          <ThemedText themeColor="text80">
            Im więcej Argus wie o kandydacie, jego partii i stanowiskach, tym trafniejsze będą
            przekazy, briefy i alerty spójności. Wpisujesz wolnym tekstem, możesz zostawić puste.
          </ThemedText>
        </View>

        <FormTextInput
          label="O kandydacie"
          value={bio}
          onChangeText={setBio}
          placeholder="Kim jest, skąd przyszedł do polityki, co go definiuje, jaka jest jego droga."
          multiline
          maxLength={CONTEXT_FIELD_MAX_LENGTH}
          autoCapitalize="sentences"
          style={styles.multiline}
        />

        <FormTextInput
          label="O partii"
          value={partyProfile}
          onChangeText={setPartyProfile}
          placeholder="Formacja, jej program, pozycjonowanie, elektorat, sojusze i różnice wobec innych."
          multiline
          maxLength={CONTEXT_FIELD_MAX_LENGTH}
          autoCapitalize="sentences"
          style={styles.multiline}
        />

        <FormTextInput
          label="Stanowiska wobec tematów"
          value={topicPositions}
          onChangeText={setTopicPositions}
          placeholder="Podejście do kluczowych tematów: podatki, gospodarka, sprawy światopoglądowe, bezpieczeństwo."
          multiline
          maxLength={CONTEXT_FIELD_MAX_LENGTH}
          autoCapitalize="sentences"
          style={styles.multilineTall}
        />

        {error ? (
          <ThemedText type="small" themeColor="error">
            {error}
          </ThemedText>
        ) : null}

        <PrimaryButton title="Zapisz" onPress={() => void handleSave()} loading={saving} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.screenTitle,
    lineHeight: FontSize.screenTitle * 1.25,
  },
  multiline: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  multilineTall: {
    minHeight: 150,
    textAlignVertical: 'top',
  },
});
