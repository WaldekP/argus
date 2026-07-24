import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DraftStatusChip } from '@/components/draft-status-chip';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  FontFamily,
  FontSize,
  KickerStyle,
  MaxContentWidth,
  Radius,
  Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { track } from '@/lib/analytics/posthog';
import {
  channelLabel,
  getDraft,
  regenerateVariant,
  setDraftStatus,
  type ContentDraft,
  type ContentVariant,
} from '@/lib/api/content';
import { formatDate } from '@/lib/format';

const COPY_CONFIRM_MS = 2000;

/** Kolor z motywu (hex #RRGGBB) z zadaną przezroczystością. */
function withOpacity(hexColor: string, opacity: number): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

/** Klucz wariantu w stanie UI (kopiowanie, regeneracja). */
function variantKey(variant: ContentVariant): string {
  return `${variant.segment_id ?? 'general'}:${variant.channel}`;
}

type VariantGroup = {
  key: string;
  name: string;
  variants: ContentVariant[];
};

/** Grupuje warianty per segment, zachowując kolejność z draftu. */
function groupVariants(variants: ContentVariant[]): VariantGroup[] {
  const groups: VariantGroup[] = [];
  for (const variant of variants) {
    const key = variant.segment_id ?? 'general';
    const existing = groups.find((group) => group.key === key);
    if (existing) {
      existing.variants.push(variant);
    } else {
      groups.push({ key, name: variant.segment_name, variants: [variant] });
    }
  }
  return groups;
}

/** Widok draftu przekazu: alerty spójności, warianty per segment, decyzja. */
export default function ContentDraftScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [draft, setDraft] = useState<ContentDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [feedbackKey, setFeedbackKey] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null);
  const [variantError, setVariantError] = useState<string | null>(null);
  const [statusSaving, setStatusSaving] = useState<'accepted' | 'rejected' | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const loadDraft = useCallback(async () => {
    if (!id) {
      setError('Nie znaleziono przekazu.');
      setLoading(false);
      return;
    }
    try {
      const loaded = await getDraft(id);
      setDraft(loaded);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Nie udało się wczytać przekazu.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const startedRef = useRef(false);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      void loadDraft();
    }
  }, [loadDraft]);

  const handleRetryLoad = () => {
    setLoading(true);
    setError(null);
    void loadDraft();
  };

  const handleCopy = async (variant: ContentVariant) => {
    await Clipboard.setStringAsync(variant.text);
    track('content_variant_copied', { channel: variant.channel });
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }
    const key = variantKey(variant);
    setCopiedKey(key);
    copyTimerRef.current = setTimeout(() => {
      setCopiedKey((current) => (current === key ? null : current));
    }, COPY_CONFIRM_MS);
  };

  const toggleFeedback = (variant: ContentVariant) => {
    const key = variantKey(variant);
    setVariantError(null);
    setFeedbackText('');
    setFeedbackKey((current) => (current === key ? null : key));
  };

  const handleRegenerate = async (variant: ContentVariant) => {
    if (!draft || regeneratingKey) {
      return;
    }
    const key = variantKey(variant);
    setRegeneratingKey(key);
    setVariantError(null);
    try {
      const updated = await regenerateVariant({
        draft_id: draft.id,
        segment_id: variant.segment_id,
        channel: variant.channel,
        feedback: feedbackText.trim() || undefined,
      });
      setDraft((current) =>
        current
          ? {
              ...current,
              variants: current.variants.map((item) =>
                variantKey(item) === key ? { ...item, text: updated.text } : item
              ),
            }
          : current
      );
      setFeedbackKey(null);
      setFeedbackText('');
    } catch (regenError) {
      setVariantError(
        regenError instanceof Error
          ? regenError.message
          : 'Nie udało się wygenerować nowej wersji.'
      );
    } finally {
      setRegeneratingKey(null);
    }
  };

  const handleSetStatus = async (status: 'accepted' | 'rejected') => {
    if (!draft || statusSaving) {
      return;
    }
    setStatusSaving(status);
    setStatusError(null);
    try {
      await setDraftStatus(draft.id, status);
      setDraft((current) => (current ? { ...current, status } : current));
    } catch (saveError) {
      setStatusError(
        saveError instanceof Error ? saveError.message : 'Nie udało się zapisać decyzji.'
      );
    } finally {
      setStatusSaving(null);
    }
  };

  const alerts = draft?.consistency_check.alerts ?? [];
  const groups = draft ? groupVariants(draft.variants) : [];

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four },
        ]}
        keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={20} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary">
            Wróć
          </ThemedText>
        </Pressable>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : null}

        {!loading && error && !draft ? (
          <View style={styles.errorBox}>
            <ThemedText type="small" themeColor="error" style={styles.centered}>
              {error}
            </ThemedText>
            <PrimaryButton title="Spróbuj ponownie" variant="secondary" onPress={handleRetryLoad} />
          </View>
        ) : null}

        {draft ? (
          <>
            <View style={styles.header}>
              <ThemedText style={styles.title}>{draft.topic}</ThemedText>
              <View style={styles.headerMeta}>
                <DraftStatusChip status={draft.status} />
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDate(draft.created_at)}
                </ThemedText>
              </View>
              {draft.core_message ? (
                <ThemedText type="small" themeColor="text80">
                  Kluczowy komunikat: {draft.core_message}
                </ThemedText>
              ) : null}
            </View>

            {alerts.length > 0 ? (
              <View
                style={[
                  styles.alertBanner,
                  {
                    borderLeftColor: theme.error,
                    backgroundColor: withOpacity(theme.error, 0.14),
                  },
                ]}>
                <ThemedText type="smallBold" themeColor="error">
                  Strażnik spójności znalazł możliwe sprzeczności z Twoją historią.
                </ThemedText>
                {alerts.map((alert, index) => (
                  <View key={index} style={styles.alertItem}>
                    <ThemedText type="small" themeColor="text80">
                      {alert.description}
                    </ThemedText>
                    {alert.suggested_response ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        Sugerowana odpowiedź: {alert.suggested_response}
                      </ThemedText>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}

            {groups.map((group) => (
              <View key={group.key} style={styles.group}>
                <ThemedText style={styles.groupName}>{group.name}</ThemedText>
                {group.variants.map((variant) => {
                  const key = variantKey(variant);
                  const copied = copiedKey === key;
                  const regenerating = regeneratingKey === key;
                  const feedbackOpen = feedbackKey === key;
                  return (
                    <ThemedView
                      key={key}
                      type="backgroundElement"
                      style={[styles.card, { borderColor: theme.border }]}>
                      <ThemedText themeColor="accent" style={styles.kicker}>
                        {channelLabel(variant.channel)}
                      </ThemedText>

                      {regenerating ? (
                        <View style={styles.cardLoader}>
                          <ActivityIndicator color={theme.accent} />
                          <ThemedText type="small" themeColor="textSecondary">
                            Generuję nową wersję.
                          </ThemedText>
                        </View>
                      ) : (
                        <ThemedText themeColor="text80">{variant.text}</ThemedText>
                      )}

                      <View style={styles.cardActions}>
                        <Pressable
                          accessibilityRole="button"
                          disabled={regenerating}
                          onPress={() => void handleCopy(variant)}
                          style={({ pressed }) => [
                            styles.actionButton,
                            { borderColor: theme.borderStrong },
                            (pressed || regenerating) && styles.dimmed,
                          ]}>
                          <Ionicons
                            name={copied ? 'checkmark' : 'copy-outline'}
                            size={16}
                            color={copied ? theme.accent : theme.accentLight}
                          />
                          <ThemedText type="small" themeColor="accentLight">
                            {copied ? 'Skopiowano' : 'Kopiuj'}
                          </ThemedText>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          disabled={regenerating}
                          onPress={() => toggleFeedback(variant)}
                          style={({ pressed }) => [
                            styles.actionButton,
                            { borderColor: theme.border },
                            (pressed || regenerating) && styles.dimmed,
                          ]}>
                          <Ionicons name="refresh" size={16} color={theme.textSecondary} />
                          <ThemedText type="small" themeColor="textSecondary">
                            Wygeneruj ponownie
                          </ThemedText>
                        </Pressable>
                      </View>

                      {feedbackOpen && !regenerating ? (
                        <View style={styles.feedbackBox}>
                          <TextInput
                            value={feedbackText}
                            onChangeText={setFeedbackText}
                            placeholder="Uwagi do nowej wersji (opcjonalnie)"
                            placeholderTextColor={theme.textSecondary}
                            multiline
                            style={[
                              styles.feedbackInput,
                              {
                                backgroundColor: theme.backgroundSelected,
                                borderColor: theme.border,
                                color: theme.text,
                              },
                            ]}
                          />
                          <PrimaryButton
                            title="Generuj nową wersję"
                            variant="secondary"
                            onPress={() => void handleRegenerate(variant)}
                          />
                        </View>
                      ) : null}
                    </ThemedView>
                  );
                })}
              </View>
            ))}

            {variantError ? (
              <ThemedText type="small" themeColor="error">
                {variantError}
              </ThemedText>
            ) : null}

            {statusError ? (
              <ThemedText type="small" themeColor="error">
                {statusError}
              </ThemedText>
            ) : null}

            <View style={styles.decision}>
              <PrimaryButton
                title="Akceptuj"
                onPress={() => void handleSetStatus('accepted')}
                loading={statusSaving === 'accepted'}
                disabled={draft.status === 'accepted' || statusSaving !== null}
              />
              <PrimaryButton
                title="Odrzuć"
                variant="secondary"
                onPress={() => void handleSetStatus('rejected')}
                loading={statusSaving === 'rejected'}
                disabled={draft.status === 'rejected' || statusSaving !== null}
              />
            </View>
          </>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
  },
  centerBox: {
    alignItems: 'center',
    paddingVertical: Spacing.six,
  },
  errorBox: {
    gap: Spacing.three,
    paddingVertical: Spacing.four,
  },
  centered: {
    textAlign: 'center',
  },
  header: {
    gap: Spacing.two,
  },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.screenTitle,
    lineHeight: FontSize.screenTitle * 1.25,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  alertBanner: {
    borderLeftWidth: 2,
    borderRadius: Radius.small,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  alertItem: {
    gap: Spacing.one,
  },
  group: {
    gap: Spacing.three,
  },
  groupName: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.section,
    lineHeight: FontSize.section * 1.3,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  kicker: {
    ...KickerStyle,
  },
  cardLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  feedbackBox: {
    gap: Spacing.two,
  },
  feedbackInput: {
    borderWidth: 1,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: FontFamily.sans,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  decision: {
    gap: Spacing.two,
  },
  dimmed: {
    opacity: 0.7,
  },
});
