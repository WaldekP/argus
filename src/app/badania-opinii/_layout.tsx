import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/auth';

/**
 * Badania opinii (CBOS) żyją poza zakładkami (wejście z zakładki Dane, własny
 * przycisk powrotu), więc bramkę sesji trzeba postawić tu osobno.
 */
export default function KnowledgeLayout() {
  const session = useAuthStore((state) => state.session);
  const initialized = useAuthStore((state) => state.initialized);

  if (initialized && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
