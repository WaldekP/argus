/**
 * Informacja o źródle danych rejestrowych.
 *
 * Dane pochodzą z Krajowego Rejestru Sądowego przez Rejestr.io, serwis
 * prowadzony przez Fundację ePaństwo (Moje Państwo). Pokazujemy to wszędzie,
 * gdzie prezentujemy te dane, z dwóch powodów: uczciwości wobec źródła i
 * dlatego, że użytkownik ma prawo wiedzieć, skąd wzięła się informacja,
 * którą za chwilę powtórzy dziennikarzowi.
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** Dodatkowe zdanie o ograniczeniach danych, jeśli jest czym uzupełnić. */
  note?: string | null;
  /** Data ostatniej synchronizacji w formacie do wyświetlenia. */
  syncedAt?: string | null;
};

export function RegistryAttribution({ note, syncedAt }: Props) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { borderTopColor: theme.border }]}>
      <ThemedText type="small" themeColor="textSecondary">
        Źródło: Krajowy Rejestr Sądowy. Dane pobierane przez Rejestr.io (Fundacja ePaństwo)
        oraz z otwartego API Ministerstwa Sprawiedliwości.
        {syncedAt ? ` Stan na ${syncedAt}.` : ''}
      </ThemedText>
      {note ? (
        <ThemedText type="small" themeColor="textSecondary">
          {note}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    marginTop: Spacing.two,
    gap: Spacing.one,
  },
});
