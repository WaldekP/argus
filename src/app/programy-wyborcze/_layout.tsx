import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/auth';

/**
 * Programy wyborcze żyją poza zakładkami (wejście z zakładki Przekaz, własny
 * przycisk powrotu), więc bramkę sesji trzeba postawić tu osobno.
 */
export default function ElectionProgramsLayout() {
  const session = useAuthStore((state) => state.session);
  const initialized = useAuthStore((state) => state.initialized);

  if (initialized && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
