import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Offer } from '@/api/types';
import { fmt, useI18n } from '@/i18n';
import { discountPct, fmtDay, fmtMoney, fmtRating, fmtTime } from '@/lib/format';
import { colors, fonts, radius, shadow, space } from '@/theme';
import { HeartButton } from './HeartButton';
import { OfferPhoto } from './OfferPhoto';

/** FR-B02/B03: box card in the feed. */
export function OfferCard({ offer, compact }: { offer: Offer; compact?: boolean }) {
  const { t } = useI18n();
  const soldOut = offer.remaining <= 0;
  const pct = discountPct(offer.priceKgs, offer.valueKgs);
  return (
    <Pressable
      testID={`offer-${offer.id}`}
      accessibilityRole="button"
      onPress={() => router.push(`/offer/${offer.id}`)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
    >
      <View style={styles.photo}>
        <OfferPhoto url={offer.template.photoUrl} category={offer.template.category} height={compact ? 96 : 132} />
        <View style={styles.topRow}>
          <View style={[styles.pill, soldOut ? styles.pillSold : styles.pillLeft]}>
            <Text style={[styles.pillText, soldOut && { color: colors.white }]}>
              {soldOut ? t.feed.soldOut : fmt(t.feed.left, { n: offer.remaining })}
            </Text>
          </View>
          {offer.isFavorite !== undefined ? (
            <HeartButton partnerId={offer.partner.id} active={!!offer.isFavorite} floating size={20} />
          ) : null}
        </View>
        {pct > 0 ? (
          <View style={styles.discount}>
            <Text style={styles.discountText}>{fmt(t.offer.discount, { p: pct })}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <View style={styles.headRow}>
          <Text style={styles.partner} numberOfLines={1}>
            {offer.partner.brandName}
          </Text>
          {offer.partner.rating != null ? (
            <View style={styles.rating}>
              <Ionicons name="star" size={13} color={colors.star} />
              <Text style={styles.ratingText}>{fmtRating(offer.partner.rating)}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {offer.template.title} · {t.category[offer.template.category]}
        </Text>
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={14} color={colors.muted} />
          <Text style={styles.meta}>
            {fmt(t.feed.pickup, {
              when: fmtDay(t, offer.pickupFrom),
              from: fmtTime(offer.pickupFrom),
              to: fmtTime(offer.pickupTo),
            })}
          </Text>
          {offer.distanceKm !== undefined ? (
            <>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.meta}>{fmt(t.feed.away, { d: String(offer.distanceKm).replace('.', ',') })}</Text>
            </>
          ) : null}
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.value}>{fmtMoney(t, offer.valueKgs)}</Text>
          <Text style={[styles.price, soldOut && { color: colors.faint }]}>{fmtMoney(t, offer.priceKgs)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg + 4,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.raise,
  },
  photo: { borderTopLeftRadius: radius.lg + 4, borderTopRightRadius: radius.lg + 4, overflow: 'hidden' },
  topRow: {
    position: 'absolute',
    top: space.sm,
    left: space.sm,
    right: space.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  pillLeft: { backgroundColor: 'rgba(255,255,255,0.95)' },
  pillSold: { backgroundColor: colors.text },
  pillText: { fontSize: 12, fontWeight: '800', color: colors.brandDark },
  discount: {
    position: 'absolute',
    bottom: space.sm,
    left: space.sm,
    backgroundColor: colors.brand,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  discountText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  body: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.lg, gap: 5 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  partner: { fontSize: 17, fontWeight: '800', color: colors.text, flex: 1 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: 13, fontWeight: '600', color: colors.text },
  title: { fontSize: 14, color: colors.muted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  meta: { fontSize: 13, color: colors.muted },
  dot: { color: colors.faint },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', gap: space.sm, marginTop: 2 },
  value: { fontSize: 14, fontWeight: '500', color: colors.muted, textDecorationLine: 'line-through', textDecorationColor: colors.muted },
  price: { fontSize: 18, fontFamily: fonts.display, color: colors.text },
});
