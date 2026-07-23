/**
 * PostHog (projekt "Argus", region EU). Inicjalizacja gated na
 * EXPO_PUBLIC_POSTHOG_KEY: brak klucza = no-op, żadnych błędów.
 */

import PostHog from 'posthog-react-native';

import type { AnalyticsEvent } from '@/lib/analytics/events';

/** Wartości właściwości eventu zgodne z JSON (wymóg typów PostHog). */
export type AnalyticsProperties = Record<string, string | number | boolean | null>;

let client: PostHog | null = null;

/** Wołaj raz z root layoutu. Bez klucza nic nie robi. */
export function initAnalytics(): void {
  if (client) {
    return;
  }
  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  if (!apiKey) {
    return;
  }
  client = new PostHog(apiKey, { host: 'https://eu.i.posthog.com' });
}

/** Wysyła event. Gdy PostHog nie jest skonfigurowany, jest no-opem. */
export function track(event: AnalyticsEvent, properties?: AnalyticsProperties): void {
  client?.capture(event, properties);
}
