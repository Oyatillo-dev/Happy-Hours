import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOffer, useReserve } from '@/api/hooks';
import { useAuth } from '@/auth/AuthContext';
import { HeartButton } from '@/components/HeartButton';
import { OfferPhoto } from '@/components/OfferPhoto';
import { Badge, Button, Card, ErrorView, Loading, Row } from '@/components/ui';
import { fmt, useI18n } from '@/i18n';
import { notice } from '@/lib/confirm';
import { discountPct, fmtMoney, fmtRating, fmtWindow } from '@/lib/format';
import { openRoute } from '@/lib/route';
import { colors, fonts, radius, space } from '@/theme';

const MAX_PER_ORDER = 3;

/** FR-B03 box details + FR-B04 reservation. */
export default function OfferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, err } = useI18n();
  const { status } = useAuth();
  const insets = useSafeAreaInsets();
  const offer = useOffer(id);
  const reserve = useReserve();
  const [qty, setQty] = useState(1);

  if (offer.isPending) return <Loading />;
  if (offer.isError) return <ErrorView error={offer.error} onRetry={() => void offer.refetch()} />;

  const o = offer.data;
  const soldOut = o.remaining <= 0;
  const closed = new Date(o.pickupTo).getTime() <= Date.now() || o.status !== 'ACTIVE';
  const maxQty = Math.max(1, Math.min(MAX_PER_ORDER, o.remaining));
  const quantity = Math.min(qty, maxQty);
  const pct = discountPct(o.priceKgs, o.valueKgs);

  const onReserve = () => {
    if (status !== 'authed') {
      router.push('/login');
      return;
    }
    reserve.mutate(
      { offerId: o.id, quantity },
      {
        onSuccess: (order) => router.replace({ pathname: '/orders/[id]', params: { id: order.id, pay: '1' } }),
        onError: (e) => {
          notice(err(e));
          void offer.refetch();
        },
      },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: o.partner.brandName,
          headerRight: () => <HeartButton partnerId={o.partner.id} active={!!o.isFavorite} />,
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View>
          <OfferPhoto url={o.template.photoUrl} category={o.template.category} height={220} />
          {pct > 0 ? (
            <View style={styles.discount}>
              <Text style={styles.discountText}>{fmt(t.offer.discount, { p: pct })}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.body}>
          <View style={{ gap: 4 }}>
            <Pressable onPress={() => router.push(`/partner/${o.partner.id}`)} style={styles.partnerRow}>
              <Text style={styles.partner}>{o.partner.brandName}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.brandDark} />
            </Pressable>
            <Text style={styles.title}>{o.template.title}</Text>
            <View style={styles.badges}>
              <Badge label={t.category[o.template.category]} />
              {soldOut ? (
                <Badge label={t.feed.soldOut} tone="danger" />
              ) : (
                <Badge label={fmt(t.feed.left, { n: o.remaining })} tone={o.remaining <= 2 ? 'warning' : 'brand'} />
              )}
              <View style={styles.rating}>
                <Ionicons name="star" size={14} color={colors.star} />
                <Text style={styles.ratingText}>
                  {o.partner.rating != null
                    ? fmt(t.offer.ratingValue, { r: fmtRating(o.partner.rating), n: o.partner.ratingCount })
                    : t.offer.noRating}
                </Text>
              </View>
            </View>
          </View>

          <Card style={styles.priceCard}>
            <View>
              <Text style={styles.priceLabel}>{t.offer.value}</Text>
              <Text style={styles.value}>{fmtMoney(t, o.valueKgs)}</Text>
            </View>
            <Text style={styles.price}>{fmtMoney(t, o.priceKgs)}</Text>
          </Card>

          <Card style={{ gap: space.md }}>
            <Row icon="time-outline">
              <Text style={styles.rowLabel}>{t.offer.pickupWindow}</Text>
              <Text style={styles.rowValue}>{fmtWindow(t, o.pickupFrom, o.pickupTo)}</Text>
            </Row>
            <Row icon="location-outline">
              <Text style={styles.rowLabel}>{t.offer.address}</Text>
              <Text style={styles.rowValue}>
                {o.location.name} · {o.location.address}
                {o.distanceKm !== undefined ? ` · ${fmt(t.feed.away, { d: o.distanceKm })}` : ''}
              </Text>
              <Pressable
                onPress={() => openRoute(o.location.lat, o.location.lng, o.partner.brandName)}
                style={styles.routeBtn}
              >
                <Ionicons name="navigate" size={16} color={colors.brandDark} />
                <Text style={styles.routeText}>{t.common.openRoute} (2GIS)</Text>
              </Pressable>
            </Row>
            <Row icon="cube-outline">
              <Text style={styles.rowLabel}>{t.offer.remaining}</Text>
              <Text style={styles.rowValue}>{fmt(t.offer.remainingOf, { n: o.remaining, total: o.quantity })}</Text>
            </Row>
          </Card>

          <Card style={{ gap: space.sm }}>
            <Text style={styles.sectionTitle}>{t.offer.description}</Text>
            {o.template.description ? <Text style={styles.text}>{o.template.description}</Text> : null}
            <Text style={styles.muted}>{t.offer.surprise}</Text>
            {o.template.weightKg ? (
              <Text style={styles.muted}>{fmt(t.offer.weight, { kg: String(o.template.weightKg).replace('.', ',') })}</Text>
            ) : null}
            {o.template.allergens ? (
              <View style={styles.allergens}>
                <Ionicons name="warning-outline" size={16} color={colors.warning} />
                <Text style={styles.allergenText}>
                  {t.offer.allergens}: {o.template.allergens}
                </Text>
              </View>
            ) : null}
          </Card>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        {soldOut || closed ? (
          <Button title={soldOut ? t.offer.soldOut : t.offer.closed} disabled onPress={() => undefined} />
        ) : (
          <>
            <View style={styles.qtyRow}>
              <Text style={styles.rowLabel}>{t.offer.quantity}</Text>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => setQty(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  style={[styles.stepBtn, quantity <= 1 && { opacity: 0.4 }]}
                  accessibilityLabel="−"
                >
                  <Ionicons name="remove" size={20} color={colors.brandDark} />
                </Pressable>
                <Text style={styles.qty}>{quantity}</Text>
                <Pressable
                  onPress={() => setQty(Math.min(maxQty, quantity + 1))}
                  disabled={quantity >= maxQty}
                  style={[styles.stepBtn, quantity >= maxQty && { opacity: 0.4 }]}
                  accessibilityLabel="+"
                >
                  <Ionicons name="add" size={20} color={colors.brandDark} />
                </Pressable>
              </View>
            </View>
            <Button
              testID="reserve"
              title={fmt(t.offer.reserve, { sum: fmtMoney(t, o.priceKgs * quantity) })}
              onPress={onReserve}
              loading={reserve.isPending}
            />
            <Text style={styles.hint}>{t.offer.reserveHint}</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.md },
  discount: {
    position: 'absolute',
    left: space.lg,
    bottom: space.md,
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  discountText: { color: colors.text, fontWeight: '800' },
  partnerRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  partner: { fontSize: 15, fontWeight: '600', color: colors.brandDark },
  title: { fontSize: 22, lineHeight: 28, fontFamily: fonts.display, color: colors.text },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center', marginTop: 4 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  priceCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceLabel: { fontSize: 12, color: colors.faint },
  value: { fontSize: 16, color: colors.faint, textDecorationLine: 'line-through' },
  price: { fontSize: 28, fontFamily: fonts.display, color: colors.text },
  rowLabel: { fontSize: 13, color: colors.muted },
  rowValue: { fontSize: 16, color: colors.text, fontWeight: '500', marginTop: 1 },
  routeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: space.sm,
    backgroundColor: colors.brandSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  routeText: { color: colors.brandDark, fontWeight: '600', fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  text: { fontSize: 15, color: colors.text, lineHeight: 21 },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  allergens: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
    backgroundColor: colors.warningSoft,
    padding: space.sm,
    borderRadius: radius.sm,
  },
  allergenText: { color: colors.warning, fontSize: 14, flex: 1 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    gap: space.sm,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qty: { fontSize: 18, fontWeight: '700', minWidth: 20, textAlign: 'center', color: colors.text },
  hint: { fontSize: 12, color: colors.faint, textAlign: 'center' },
});
