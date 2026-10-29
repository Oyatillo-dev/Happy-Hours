import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useOffers } from '@/api/hooks';
import { FiltersBar } from '@/components/Filters';
import { groupByLocation } from '@/components/mapGroups';
import { OfferCard } from '@/components/OfferCard';
import { OffersMap } from '@/components/OffersMap';
import { Banner } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useFilters } from '@/lib/filters';
import { useUserLocation } from '@/lib/location';
import { openRoute } from '@/lib/route';
import { colors, radius, space } from '@/theme';

/** FR-B02: map view — one marker per location; tapping shows its boxes. */
export default function MapScreen() {
  const { t, err } = useI18n();
  const location = useUserLocation();
  const { filters } = useFilters();
  const offers = useOffers(filters, location);
  const groups = useMemo(() => groupByLocation(offers.data?.items ?? []), [offers.data]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = groups.find((g) => g.location.id === selectedId) ?? null;

  return (
    <View style={styles.screen}>
      <FiltersBar showSearch={false} />
      <View style={styles.mapWrap}>
        <OffersMap
          groups={groups}
          center={location}
          showsUser={location.precise}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <View style={styles.overlayTop} pointerEvents="box-none">
          {!location.precise && location.ready ? <Banner text={t.feed.locationDenied} icon="navigate-outline" /> : null}
          {offers.isError ? <Banner tone="danger" text={err(offers.error)} /> : null}
          {offers.isFetching ? <ActivityIndicator color={colors.brand} /> : null}
        </View>
        {selected ? (
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Pressable style={{ flex: 1 }} onPress={() => router.push(`/partner/${selected.offers[0]?.partner.id}`)}>
                <Text style={styles.sheetTitle}>{selected.partnerName}</Text>
                <Text style={styles.sheetSub}>{selected.location.address}</Text>
              </Pressable>
              <Pressable
                style={styles.routeBtn}
                onPress={() => openRoute(selected.location.lat, selected.location.lng, selected.partnerName)}
              >
                <Ionicons name="navigate" size={16} color={colors.brandDark} />
                <Text style={styles.routeText}>{t.common.openRoute}</Text>
              </Pressable>
              <Pressable hitSlop={10} onPress={() => setSelectedId(null)} accessibilityLabel={t.common.close}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
              {selected.offers.map((o) => (
                <View key={o.id} style={{ width: 260 }}>
                  <OfferCard offer={o} compact />
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  mapWrap: { flex: 1 },
  overlayTop: { position: 'absolute', top: space.sm, left: space.lg, right: space.lg, gap: space.sm },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: space.lg,
    gap: space.md,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  sheetSub: { fontSize: 13, color: colors.muted },
  routeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.brandSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  routeText: { color: colors.brandDark, fontWeight: '600', fontSize: 13 },
});
