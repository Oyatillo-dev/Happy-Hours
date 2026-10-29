import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Order, OrderStatus } from '@/api/types';
import { fmt, useI18n } from '@/i18n';
import { fmtMoney, fmtWindow } from '@/lib/format';
import { colors, radius, space } from '@/theme';
import { OfferPhoto } from './OfferPhoto';
import { Badge } from './ui';

export function statusTone(s: OrderStatus): 'brand' | 'warning' | 'muted' | 'danger' {
  if (s === 'PAID' || s === 'READY') return 'brand';
  if (s === 'PENDING_PAYMENT') return 'warning';
  if (s === 'CANCELLED_BY_PARTNER' || s === 'NO_SHOW') return 'danger';
  return 'muted';
}

export function OrderRow({ order }: { order: Order }) {
  const { t } = useI18n();
  return (
    <Pressable
      testID={`order-${order.id}`}
      onPress={() => router.push(`/orders/${order.id}`)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}
    >
      <OfferPhoto url={order.offer.template.photoUrl} category={order.offer.template.category} height={64} style={styles.photo} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.head}>
          <Text style={styles.partner} numberOfLines={1}>
            {order.offer.partner.brandName}
          </Text>
          <Badge label={t.order.status[order.status]} tone={statusTone(order.status)} />
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {order.offer.template.title} · {fmt(t.order.quantityAmount, { q: order.quantity, sum: fmtMoney(t, order.amountKgs) })}
        </Text>
        <View style={styles.when}>
          <Ionicons name="time-outline" size={13} color={colors.muted} />
          <Text style={styles.meta}>{fmtWindow(t, order.offer.pickupFrom, order.offer.pickupTo)}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.md,
  },
  photo: { width: 64, borderRadius: radius.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, justifyContent: 'space-between' },
  partner: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  meta: { fontSize: 13, color: colors.muted },
  when: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
