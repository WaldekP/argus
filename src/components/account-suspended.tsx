import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EyeDot } from '@/components/eye-dot';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, FontSize, KickerStyle, MaxContentWidth, Spacing } from '@/constants/theme';
import { signOut } from '@/store/auth';

/**
 * Ekran zawieszonego konta.
 *
 * Root layout pokazuje go zamiast całej nawigacji, gdy użytkownik ma w
 * `app_metadata` flagę `suspended` (ustawia ją tylko serwer, klient nie może
 * jej zmienić). Edge Functions odrzucają zapytania takiego konta niezależnie
 * od tego ekranu (`authenticateRequest`), więc to nie jest jedyna zapora,
 * tylko komunikat dla człowieka.
 *
 * Pierwsze zawieszenie: konto pilotażowe Petru, 2026-10-28, po trzech
 * tygodniach bez aktywności (decyzja usera).
 */
export function AccountSuspended() {
  const insets = useSafeAreaInsets();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <ThemedView
      style={[
        styles.screen,
        { paddingTop: insets.top + Spacing.six, paddingBottom: insets.bottom + Spacing.six },
      ]}>
      <View style={styles.content}>
        <EyeDot size={16} />
        <ThemedText type="small" themeColor="accentLight" style={KickerStyle}>
          ARGUS
        </ThemedText>
        <ThemedText style={styles.title}>Konto zawieszone</ThemedText>
        <ThemedText themeColor="text80" style={styles.body}>
          Konto zostało zawieszone z powodu braku aktywności. Twoje dane pozostają zapisane, ale
          korzystanie z aplikacji jest wstrzymane.
        </ThemedText>
        <PrimaryButton
          title="Wyloguj"
          variant="secondary"
          loading={signingOut}
          onPress={() => {
            setSigningOut(true);
            void signOut().finally(() => setSigningOut(false));
          }}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.four },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    alignItems: 'center',
    gap: Spacing.three,
  },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.screenTitle,
    lineHeight: FontSize.screenTitle * 1.25,
    textAlign: 'center',
  },
  body: { textAlign: 'center' },
});
