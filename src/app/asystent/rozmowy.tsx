import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackLink } from '@/components/back-link';
import { EyeDot } from '@/components/eye-dot';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, FontSize, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listConversations, type AssistantConversation } from '@/lib/api/assistant';
import { formatDate } from '@/lib/format';

/**
 * Historia rozmów z asystentem Argusem (link w prawym górnym rogu zakładki
 * Asystent). Wybór rozmowy wraca na /asystent-argus z parametrem `cid`
 * i wątek ładuje się z bazy.
 */
export default function ConversationsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const result = await listConversations();
      setConversations(result.conversations);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Nie udało się wczytać historii rozmów.'
      );
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadConversations();
    }, [loadConversations])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  }, [loadConversations]);

  const openConversation = (conversation: AssistantConversation) => {
    router.push({ pathname: '/asystent-argus', params: { cid: conversation.id } });
  };

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }>
        <BackLink />

        <View style={styles.header}>
          <ThemedText style={styles.title}>Rozmowy z Argusem</ThemedText>
          <ThemedText themeColor="textSecondary">
            Każda rozmowa jest zapisana. Wybierz wątek, żeby wrócić do niego i pytać dalej.
          </ThemedText>
        </View>

        {!loaded ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : null}

        {loaded && error ? (
          <View style={styles.errorBox}>
            <ThemedText type="small" themeColor="error" style={styles.centered}>
              {error}
            </ThemedText>
            <PrimaryButton
              title="Spróbuj ponownie"
              variant="secondary"
              onPress={() => {
                setLoaded(false);
                setError(null);
                void loadConversations();
              }}
            />
          </View>
        ) : null}

        {loaded && !error && conversations.length === 0 ? (
          <View style={styles.emptyState}>
            <EyeDot size={14} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
              Nie masz jeszcze żadnej rozmowy. Zadaj Argusowi pierwsze pytanie z zakładki
              Asystent albo z Pulpitu.
            </ThemedText>
          </View>
        ) : null}

        {conversations.length > 0 ? (
          <View style={styles.cards}>
            {conversations.map((conversation) => (
              <Pressable
                key={conversation.id}
                accessibilityRole="button"
                accessibilityLabel={`Otwórz rozmowę: ${conversation.title}`}
                onPress={() => openConversation(conversation)}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  pressed && styles.dimmed,
                ]}>
                <ThemedText style={styles.cardTitle}>{conversation.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDate(conversation.updated_at.slice(0, 10))}
                </ThemedText>
              </Pressable>
            ))}
          </View>
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
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.screenTitle,
    lineHeight: FontSize.screenTitle * 1.25,
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
  emptyState: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  cards: {
    gap: Spacing.three,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  cardTitle: {
    fontFamily: FontFamily.sansSemiBold,
  },
  dimmed: {
    opacity: 0.7,
  },
});
