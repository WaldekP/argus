/**
 * Klient Supabase (auth + dane). Klucz anon jest publiczny; klucz serwisowy
 * i klucz Claude NIGDY nie trafiają na klienta (patrz CLAUDE.md).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

if (!isWeb) {
  // Polyfill URL potrzebny tylko na native (web ma natywne URL API).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-url-polyfill/auto');
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Brak konfiguracji Supabase. Ustaw EXPO_PUBLIC_SUPABASE_URL i EXPO_PUBLIC_SUPABASE_ANON_KEY ' +
      'w pliku .env (wzór znajdziesz w .env.example), a potem zrestartuj serwer deweloperski.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: isWeb
    ? {
        // Na web: domyślny storage (localStorage) i odczyt sesji z URL po OAuth.
        detectSessionInUrl: true,
      }
    : {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
});
