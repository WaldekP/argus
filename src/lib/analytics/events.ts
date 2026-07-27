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
  /** Brief dnia (synteza): regeneracja przeglądu i wejście w źródło wydarzenia. */
  | 'morning_brief_generated'
  | 'daily_brief_item_source_opened'
  /** Pomysły na tweety (X) z briefu dnia: generacja i skopiowanie wpisu. */
  | 'brief_tweets_generated'
  | 'brief_tweet_copied'
  /** Asystent Argus: pytanie zadane z Pulpitu (własne albo z propozycji) lub z ekranu rozmowy. */
  | 'assistant_question_asked'
  | 'journalist_viewed'
  | 'media_searched'
  | 'analysis_created'
  | 'analysis_viewed'
  | 'analysis_document_added'
  /** Tematyczne bazy wiedzy: wejście w temat, sekcję i kartę polityka. */
  | 'topic_opened'
  | 'topic_section_viewed'
  | 'topic_politician_viewed'
  /** Dossier tematyczne (upload analizy → podsumowanie, liczby, pytania, linie). */
  | 'topic_created'
  | 'topic_viewed'
  | 'topic_document_added'
  | 'topic_question_asked'
  /** Wzmianki prasowe w briefie porannym: hasła, odświeżenie, wejście w artykuł. */
  | 'watch_term_added'
  | 'watch_term_removed'
  | 'mentions_synced'
  | 'mention_opened'
  /** Pobranie PDF programu wyborczego z ekranu Programy wyborcze. */
  | 'election_program_downloaded';
