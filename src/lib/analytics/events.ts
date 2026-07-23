/**
 * Typowany zestaw eventów PostHog (patrz CLAUDE.md, sekcja "Analytics").
 * North star: liczba briefów tygodniowo per tenant.
 */

export type AnalyticsEvent =
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'sejm_import_completed'
  | 'brief_created'
  | 'brief_viewed'
  | 'brief_rated'
  | 'brief_question_feedback'
  | 'content_generated'
  | 'content_variant_copied'
  | 'consistency_alert_shown'
  | 'consistency_alert_resolved'
  | 'practice_session_started'
  | 'practice_session_finished'
  | 'morning_brief_read'
  | 'journalist_viewed'
  | 'media_searched';
