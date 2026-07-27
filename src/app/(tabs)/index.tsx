import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AskArgusCard } from '@/components/ask-argus-card';
import { MorningBriefSection } from '@/components/morning-brief-section';
import { MpMandateBar } from '@/components/mp-mandate';
import { ScreenPlaceholder } from '@/components/screen-placeholder';
import { Spacing } from '@/constants/theme';
import { readMpIdentity } from '@/lib/api/onboarding';
import { useOnboardingStore } from '@/store/onboarding';

export default function TodayScreen() {
  const router = useRouter();
  const identity = readMpIdentity(useOnboardingStore((state) => state.profile));

  return (
    <ScreenPlaceholder
      title="Pulpit"
      description="Dzień dobry. Tu zobaczysz najważniejsze na dzisiaj: syntezę prasową i szybki dostęp do Argusa.">
      <View style={styles.cards}>
        {identity ? (
          <MpMandateBar identity={identity} onPress={() => router.push('/profile')} />
        ) : null}

        <AskArgusCard />

        <MorningBriefSection />
      </View>
    </ScreenPlaceholder>
  );
}

const styles = StyleSheet.create({
  cards: {
    gap: Spacing.three,
  },
});
