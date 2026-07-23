import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormTextInput } from '@/components/form-text-input';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, MaxContentWidth, Spacing } from '@/constants/theme';
import { signUp } from '@/store/auth';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSignUp = async () => {
    if (!email.trim() || !password || !passwordRepeat) {
      setError('Wypełnij wszystkie pola.');
      return;
    }
    if (password.length < 8) {
      setError('Hasło musi mieć co najmniej 8 znaków.');
      return;
    }
    if (password !== passwordRepeat) {
      setError('Hasła nie są takie same.');
      return;
    }
    setError(null);
    setLoading(true);
    const result = await signUp(email, password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
  };

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + Spacing.six, paddingBottom: insets.bottom + Spacing.four },
          ]}
          keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <ThemedText themeColor="accent" style={styles.brand}>
              Argus
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              Załóż konto i bądź gotowy_a na każdy wywiad.
            </ThemedText>
          </View>

          {done ? (
            <View style={styles.form}>
              <ThemedText themeColor="success">
                Konto utworzone. Sprawdź skrzynkę e-mail i kliknij link potwierdzający, a potem
                zaloguj się.
              </ThemedText>
              <Link href="/(auth)/login">
                <ThemedText type="small" themeColor="accent" style={styles.linkText}>
                  Przejdź do logowania
                </ThemedText>
              </Link>
            </View>
          ) : (
            <>
              <View style={styles.form}>
                <FormTextInput
                  label="E-mail"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="imie@przyklad.pl"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                />
                <FormTextInput
                  label="Hasło"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Co najmniej 8 znaków"
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                />
                <FormTextInput
                  label="Powtórz hasło"
                  value={passwordRepeat}
                  onChangeText={setPasswordRepeat}
                  placeholder="To samo hasło jeszcze raz"
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                  onSubmitEditing={handleSignUp}
                />

                {error ? (
                  <ThemedText type="small" themeColor="error">
                    {error}
                  </ThemedText>
                ) : null}

                <PrimaryButton title="Załóż konto" onPress={handleSignUp} loading={loading} />
              </View>

              <View style={styles.footer}>
                <ThemedText type="small" themeColor="textSecondary">
                  Masz już konto?
                </ThemedText>
                <Link href="/(auth)/login">
                  <ThemedText type="small" themeColor="accent" style={styles.linkText}>
                    Zaloguj się
                  </ThemedText>
                </Link>
              </View>
            </>
          )}
        </ScrollView>
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
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
    gap: Spacing.five,
  },
  header: {
    gap: Spacing.two,
  },
  brand: {
    fontFamily: FontFamily.serifBold,
    fontSize: 48,
    lineHeight: 56,
  },
  form: {
    gap: Spacing.three,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  linkText: {
    fontFamily: FontFamily.sansSemiBold,
  },
});
