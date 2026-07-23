import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/auth';

export default function AuthLayout() {
  const session = useAuthStore((state) => state.session);

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
