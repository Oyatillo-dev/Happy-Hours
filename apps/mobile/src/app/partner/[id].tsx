import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePartner } from '@/api/hooks';
import { HeartButton } from '@/components/HeartButton';
import { OfferCard } from '@/components/OfferCard';
import { Card, ErrorView, Loading, SectionTitle, Stars } from '@/components/ui';
import { fmt, useI18n } from '@/i18n';
import { fmtDateTime, fmtRating } from '@/lib/format';
import { openRoute } from '@/lib/route';
import { colors, radius, space } from '@/theme';

/** FR-B09: partner page with today's boxes and reviews. */
export default function PartnerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const partner = usePartner(id);

  if (partner.isPending) return <Loading />;
  if (partner.isError) return <ErrorView error={partner.error} onRetry={() => void partner.refetch()} />;
  const p = partner.data;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={partner.isRefetching}
          onRefresh={() => void partner.refetch()}
          tintColor={colors.brand}
          colors={[colors.brand]}
        />
      }
    >
      <Stack.Screen options={{ title: p.brandName }} />
      <Card style={styles.head}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>{p.brandName.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.name}>{p.brandName}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color={colors.star} />
            <Text style={styles.muted}>
              {p.rating != null ? fmt(t.offer.ratingValue, { r: fmtRating(p.rating), n: p.ratingCount }) : t.offer.noRating}
            </Text>
          </View>
        </View>
        <HeartButton partnerId={p.id} active={p.isFavorite} size={26} />
      </Card>

      <View>
        <SectionTitle>{t.partner.todayOffers}</SectionTitle>
        {p.offers.length === 0 ? (
          <Text style={styles.muted}>{t.partner.noOffers}</Text>
        ) : (
          <View style={{ gap: space.md }}>
            {p.offers.map((o) => (
              <OfferCard key={o.id} offer={{ ...o, isFavorite: undefined }} compact />
            ))}
          </View>
        )}
      </View>

      <View>
        <SectionTitle>{t.partner.locations}</SectionTitle>
        <Card style={{ gap: space.md }}>
          {p.locations.map((l) => (
            <View key={l.id} style={styles.locRow}>
              <Ionicons name="location-outline" size={18} color={colors.muted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.locName}>{l.name}</Text>
                <Text style={styles.muted}>{l.address}</Text>
                {l.openTime && l.closeTime ? (
                  <Text style={styles.muted}>{fmt(t.partner.hours, { from: l.openTime, to: l.closeTime })}</Text>
                ) : null}
              </View>
              <Pressable style={styles.route} onPress={() => openRoute(l.lat, l.lng, p.brandName)}>
                <Ionicons name="navigate" size={15} color={colors.brandDark} />
                <Text style={styles.routeText}>{t.common.openRoute}</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      </View>

      <View>
        <SectionTitle>{t.partner.reviews}</SectionTitle>
        {p.reviews.length === 0 ? (
          <Text style={styles.muted}>{t.partner.noReviews}</Text>
        ) : (
          <View style={{ gap: space.sm }}>
            {p.reviews.map((r, i) => (
              <Card key={i} style={{ gap: 4, padding: space.md }}>
                <View style={styles.reviewHead}>
                  <Stars value={r.rating ?? 0} size={14} />
                  <Text style={styles.faint}>{fmtDateTime(t, r.createdAt)}</Text>
                </View>
                {r.text ? <Text style={styles.text}>{r.text}</Text> : null}
                {r.author ? <Text style={styles.faint}>{r.author}</Text> : null}
              </Card>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xl * 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  logo: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 24, fontWeight: '800', color: colors.brandDark },
  name: { fontSize: 20, fontWeight: '800', color: colors.text },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  muted: { fontSize: 14, color: colors.muted },
  faint: { fontSize: 12, color: colors.faint },
  text: { fontSize: 15, color: colors.text, lineHeight: 21 },
  locRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  locName: { fontSize: 15, fontWeight: '600', color: colors.text },
  route: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.brandSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  routeText: { color: colors.brandDark, fontWeight: '600', fontSize: 13 },
  reviewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
