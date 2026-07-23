import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const emptySubscribe = () => () => {};

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web.
 * Na serwerze (i przed hydracją) zwraca 'light', po hydracji realny schemat.
 */
export function useColorScheme() {
  const colorScheme = useRNColorScheme();
  const hasHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  return hasHydrated ? colorScheme : 'light';
}
