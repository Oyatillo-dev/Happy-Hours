import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fmt, useI18n } from '@/i18n';
import { colors, radius, space } from '@/theme';
import { Banner } from './ui';
import type { LocationGroup } from './mapGroups';

/** The map's locations as a list, for where no map can be shown (the web, Android without a Maps key). */
export function OffersList({
  groups,
  selectedId,
  onSelect,
  notice,
}: {
  groups: LocationGroup[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  notice: string;
}) {
  const { t } = useI18n();
  return (
    <ScrollView style={StyleSheet.absoluteFill} contentContainerStyle={styles.list}>
      <Banner tone="info" icon="map-outline" text={notice} />
      {groups.map((g) => (
        <Pressable
          key={g.location.id}
          onPress={() => onSelect(g.location.id === selectedId ? null : g.location.id)}
          style={[styles.item, g.location.id === selectedId && styles.itemActive]}
        >
          <Ionicons name="location" size={20} color={colors.brand} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{g.partnerName}</Text>
            <Text style={styles.address}>{g.location.address}</Text>
          </View>
          <Text style={styles.count}>{fmt(t.map.boxesHere, { n: g.offers.length })}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, gap: space.sm, paddingBottom: 260 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.card,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemActive: { borderColor: colors.brand },
  name: { fontWeight: '700', color: colors.text, fontSize: 15 },
  address: { color: colors.muted, fontSize: 13 },
  count: { color: colors.brandDark, fontWeight: '600', fontSize: 13 },
});
