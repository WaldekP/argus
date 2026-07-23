import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormTextInput } from '@/components/form-text-input';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, MaxContentWidth, Spacing } from '@/constants/theme';
import { signIn, signInWithGoogle } from '@/store/auth';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError('Podaj e-mail i hasło.');
      return;
    }
    setError(null);
    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    }
    // Po sukcesie przekierowanie robi (auth)/_layout.tsx.
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    const result = await signInWithGoogle();
    setGoogleLoading(false);
    if (result.error) {
      setError(result.error);
    }
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
              Zaloguj się, aby wrócić do swoich briefów i przekazu.
            </ThemedText>
          </View>

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
              placeholder="Twoje hasło"
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              onSubmitEditing={handleSignIn}
            />

            {error ? (
              <ThemedText type="small" themeColor="error">
                {error}
              </ThemedText>
            ) : null}

            <PrimaryButton title="Zaloguj się" onPress={handleSignIn} loading={loading} />
            <PrimaryButton
              title="Kontynuuj z Google"
              variant="secondary"
              onPress={handleGoogle}
              loading={googleLoading}
            />
          </View>

          <View style={styles.footer}>
            <ThemedText type="small" themeColor="textSecondary">
              Nie masz jeszcze konta?
            </ThemedText>
            <Link href="/(auth)/register">
              <ThemedText type="small" themeColor="accent" style={styles.linkText}>
                Załóż konto
              </ThemedText>
            </Link>
          </View>
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
