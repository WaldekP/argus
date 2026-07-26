/**
 * Otwieranie linków zewnętrznych.
 *
 * `Linking.openURL` odrzuca promise, gdy adresu nie da się obsłużyć, a adresy
 * w Argusie pochodzą z kanałów RSS i z API Sejmu, czyli z zewnątrz. Wołane
 * wprost w `onPress` dawało nieobsłużone odrzucenie promise'a zamiast
 * komunikatu. Ten helper nigdy nie rzuca: mówi tylko, czy się udało.
 */

import { Linking } from 'react-native';

/** Otwiera adres w przeglądarce. Zwraca false, gdy się nie udało. */
export async function openExternalUrl(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
