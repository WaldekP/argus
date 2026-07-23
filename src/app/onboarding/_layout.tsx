import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/auth';

export default function OnboardingLayout() {
  const session = useAuthStore((state) => state.session);
  const initialized = useAuthStore((state) => state.initialized);

  if (initialized && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="import" />
      <Stack.Screen name="interview" />
      <Stack.Screen name="style" />
      <Stack.Screen name="segments" />
    </Stack>
  );
}
