import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ScreenPlaceholder } from '@/components/screen-placeholder';
import { SectionCard } from '@/components/section-card';
import { Spacing } from '@/constants/theme';

/**
 * Zakładka Dane: katalog danych referencyjnych, na których pracują analizy.
 * Politycy (na żywo z API Sejmu), dziennikarze (baza globalna) i programy
 * wyborcze (PDF-y w Storage).
 */
export default function DaneScreen() {
  const router = useRouter();

  return (
    <ScreenPlaceholder
      title="Dane"
      description="Materiały źródłowe, na których pracuje Argus: ludzie, redakcje i dokumenty.">
      <View style={styles.cards}>
        <SectionCard
          icon="people-outline"
          title="Politycy"
          description="Wszyscy posłowie obecnej kadencji, na żywo z API Sejmu: klub, okręg, liczba głosów."
          onPress={() => router.push('/politycy')}
        />
        <SectionCard
          icon="newspaper-outline"
          title="Dziennikarze"
          description="Baza dziennikarzy i redakcji z publicznych stron autorskich, z tematami i kontaktami."
          onPress={() => router.push('/dziennikarze')}
        />
        <SectionCard
          icon="document-attach-outline"
          title="Programy wyborcze"
          description="Oficjalne dokumenty partii sejmowych z wyborów 2011, 2015, 2019 i 2023, do pobrania jako PDF."
          onPress={() => router.push('/programy-wyborcze')}
        />
      </View>
    </ScreenPlaceholder>
  );
}

const styles = StyleSheet.create({
  cards: {
    gap: Spacing.three,
  },
});
