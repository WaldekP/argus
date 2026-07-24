import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontFamily, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { initialsFromName, mpPhotoUrl, type MpPhotoSize } from '@/lib/sejm-photo';

export type MpAvatarProps = {
  /** Identyfikator posła w API Sejmu. Bez niego pokazujemy inicjały. */
  mpId: number | null;
  /** Imię i nazwisko, źródło inicjałów i etykiety dostępności. */
  name: string;
  /** Bok kwadratu w punktach. */
  size?: number;
  /** Wariant zdjęcia. Miniatura wystarcza do rozmiaru ok. 48. */
  photoSize?: MpPhotoSize;
};

/**
 * Awatar posła: zdjęcie z API Sejmu w złotej obwódce, z inicjałami jako
 * zapasem. API bywa niedostępne, więc każdy błąd pobrania cicho przechodzi
 * na inicjały, zamiast zostawiać pustą ramkę.
 */
export function MpAvatar({ mpId, name, size = 48, photoSize = 'full' }: MpAvatarProps) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);

  const frame = {
    width: size,
    height: size,
    borderRadius: Radius.full,
    borderColor: theme.border,
    backgroundColor: theme.backgroundSelected,
  };

  if (mpId === null || failed) {
    return (
      <View
        accessibilityRole="image"
        accessibilityLabel={`Zdjęcie niedostępne: ${name}`}
        style={[styles.frame, styles.fallback, frame]}>
        <ThemedText
          themeColor="accentLight"
          style={[styles.initials, { fontSize: Math.round(size * 0.36) }]}>
          {initialsFromName(name)}
        </ThemedText>
      </View>
    );
  }

  return (
    <Image
      accessibilityRole="image"
      accessibilityLabel={`Zdjęcie: ${name}`}
      source={{ uri: mpPhotoUrl(mpId, photoSize) }}
      contentFit="cover"
      transition={200}
      onError={() => setFailed(true)}
      style={[styles.frame, frame]}
    />
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 1,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: FontFamily.serif,
  },
});
