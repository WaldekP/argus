import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ScreenPlaceholder } from '@/components/screen-placeholder';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { signOut, useAuthStore } from '@/store/auth';

export default function ProfileScreen() {
  const session = useAuthStore((state) => state.session);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setError(null);
    setLoading(true);
    const result = await signOut();
    setLoading(false);
    if (result.error) {
      setError(result.error);
    }
    // Po wylogowaniu przekierowanie robi (tabs)/_layout.tsx.
  };

  return (
    <ScreenPlaceholder
      title="Profil"
      description="Twój graf kontekstu: dane z Sejmu, profil stylu językowego i ustawienia konta. Onboarding z importem pojawi się wkrótce.">
      <View style={styles.section}>
        {session?.user.email ? (
          <ThemedText type="small" themeColor="textSecondary">
            Zalogowano jako {session.user.email}
          </ThemedText>
        ) : null}

        {error ? (
          <ThemedText type="small" themeColor="error">
            {error}
          </ThemedText>
        ) : null}

        <PrimaryButton
          title="Wyloguj się"
          variant="secondary"
          onPress={handleSignOut}
          loading={loading}
        />
      </View>
    </ScreenPlaceholder>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
    marginTop: Spacing.four,
  },
});
