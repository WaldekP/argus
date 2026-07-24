import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/auth';

/**
 * Wystąpienia sejmowe żyją poza zakładkami (pełna szerokość, własny przycisk
 * powrotu), więc bramkę sesji trzeba postawić tu osobno.
 */
export default function StatementsLayout() {
  const session = useAuthStore((state) => state.session);
  const initialized = useAuthStore((state) => state.initialized);

  if (initialized && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
