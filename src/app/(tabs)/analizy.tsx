import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ScreenPlaceholder } from '@/components/screen-placeholder';
import { SectionCard } from '@/components/section-card';
import { Spacing } from '@/constants/theme';

/**
 * Zakładka Analizy: hub typów analiz. Działa analiza zagadnień; pozostałe
 * oznaczone „Wkrótce" (niespójności i przekaz zdjęte z huba decyzją usera
 * 2026-07-27, ekrany /analysis i /content zostają w kodzie).
 */
export default function AnalizyScreen() {
  const router = useRouter();

  return (
    <ScreenPlaceholder
      title="Analizy"
      description="Wybierz rodzaj analizy. Argus pracuje na danych z Sejmu, Twoich dokumentach i profilu Twojego przekazu.">
      <View style={styles.cards}>
        <SectionCard
          icon="library-outline"
          title="Analiza zagadnień"
          description="Dossiery z Twoich analiz i gotowe zagadnienia programowe: liczby, pytania, linie ataku i obrony."
          onPress={() => router.push('/topics')}
        />
        <SectionCard
          icon="search-outline"
          title="Analiza niespójności"
          description="Wskaż temat i cel, a Argus znajdzie sprzeczności w wypowiedziach i głosowaniach z Sejmu."
        />
        <SectionCard
          icon="megaphone-outline"
          title="Analiza przekazu"
          description="Warianty treści per segment wyborców i kanał, z kontrolą spójności z historią wypowiedzi."
        />
        <SectionCard
          icon="videocam-outline"
          title="Analiza wystąpień"
          description="Wgraj wystąpienie, a Argus oceni, jak poszło i czy przekaz był spójny z Twoim profilem."
        />
        <SectionCard
          icon="pulse-outline"
          title="Analiza sentymentu"
          description="Jak media i sieć mówią o Tobie i Twoich tematach: ton, natężenie, zmiany w czasie."
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
