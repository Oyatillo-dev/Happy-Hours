import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { resolveApiUrl } from '@/api/client';
import type { Category } from '@/api/types';
import { categoryLook } from '@/theme';

/** Box photo, or a coloured placeholder with the category icon. */
export function OfferPhoto({
  url,
  category,
  height,
  style,
}: {
  url: string | null;
  category: Category;
  height: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [failed, setFailed] = useState(false);
  const look = categoryLook[category] ?? categoryLook.MIXED;
  const src = resolveApiUrl(url);
  return (
    <View style={[styles.box, { height, backgroundColor: look.bg }, style]}>
      {src && !failed ? (
        <Image source={{ uri: src }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} />
      ) : (
        <MaterialCommunityIcons name={look.icon} size={Math.min(64, height * 0.45)} color={look.fg} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
