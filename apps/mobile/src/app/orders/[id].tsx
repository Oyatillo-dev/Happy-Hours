import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { resolveApiUrl } from '@/api/client';
import { keys, useCancelOrder, useOrder, useReview, useStartPayment } from '@/api/hooks';
import type { Order } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { LoginPrompt } from '@/components/LoginPrompt';
import { OfferPhoto } from '@/components/OfferPhoto';
import { statusTone } from '@/components/OrderRow';
import { Badge, Banner, Button, Card, ErrorView, Loading, Row, Stars } from '@/components/ui';
import { fmt, useI18n } from '@/i18n';
import { confirm, notice } from '@/lib/confirm';
import { fmtCountdown, fmtDateTime, fmtDuration, fmtMoney, fmtTime, fmtWindow } from '@/lib/format';
import { openRoute } from '@/lib/route';
import { useNow } from '@/lib/useNow';
import { colors, radius, space } from '@/theme';
import { useQueryClient } from '@tanstack/react-query';

const PAYMENT_POLL_MS = 90_000;

/** FR-B05 payment, FR-B06 QR + code (offline-capable), FR-B07 cancel, FR-B10 review/complaint. */
export default function OrderScreen() {
  const { id, pay } = useLocalSearchParams<{ id: string; pay?: string }>();
  const { t, err } = useI18n();
  const { status } = useAuth();
  const qc = useQueryClient();
  const [awaitingUntil, setAwaitingUntil] = useState(0);
  const now = useNow(1000);
  const awaiting = awaitingUntil > now;
  const query = useOrder(id, { poll: awaiting });
  const startPayment = useStartPayment();
  const cancel = useCancelOrder();
  const [payError, setPayError] = useState<string | null>(null);
  const autoPayDone = useRef(false);

  const order = query.data?.data;

  const openPayment = useCallback(
    async (o: Order) => {
      setPayError(null);
      try {
        const url = resolveApiUrl(o.payUrl ?? (await startPayment.mutateAsync(o.id)).payUrl);
        if (!url) return;
        setAwaitingUntil(Date.now() + PAYMENT_POLL_MS);
        if (Platform.OS === 'web') {
          // No custom-scheme redirect on web: open the bank page in a new tab and poll.
          await WebBrowser.openBrowserAsync(url);
        } else {
          // The mock bank page links back to happyhours://orders/{id}, which closes the session.
          await WebBrowser.openAuthSessionAsync(url, 'happyhours://');
          await qc.invalidateQueries({ queryKey: keys.order(o.id) });
        }
      } catch (e) {
        setAwaitingUntil(0);
        setPayError(err(e));
        void query.refetch();
      }
    },
    [err, qc, query, startPayment],
  );

  // Coming from "Забронировать": open the payment page right away.
  useEffect(() => {
    if (pay === '1' && order?.status === 'PENDING_PAYMENT' && !autoPayDone.current && !query.data?.fromCache) {
      autoPayDone.current = true;
      void openPayment(order);
    }
  }, [pay, order, openPayment, query.data?.fromCache]);

  // Stop polling once the status changed.
  useEffect(() => {
    if (order && order.status !== 'PENDING_PAYMENT' && awaitingUntil) setAwaitingUntil(0);
  }, [order, awaitingUntil]);

  // Reservation ran out while the screen is open → reload to get EXPIRED.
  const reservedLeft = order ? new Date(order.reservedUntil).getTime() - now : 0;
  const reservationOver = order?.status === 'PENDING_PAYMENT' && reservedLeft <= 0;
  const { refetch } = query;
  useEffect(() => {
    if (reservationOver) void refetch();
  }, [reservationOver, refetch]);

  if (status === 'guest') return <LoginPrompt />;
  if (query.isPending) return <Loading />;
  if (query.isError || !order) return <ErrorView error={query.error} onRetry={() => void query.refetch()} />;

  const o = order.offer;
  const from = new Date(o.pickupFrom).getTime();
  const to = new Date(o.pickupTo).getTime();
  const isActive = order.status === 'PAID' || order.status === 'READY';

  const onCancel = async () => {
    const ok = await confirm(
      t.order.cancelConfirmTitle,
      order.status === 'PENDING_PAYMENT' ? t.order.cancelConfirmPending : t.order.cancelConfirmPaid,
      { ok: t.order.cancel, cancel: t.common.no },
      true,
    );
    if (!ok) return;
    cancel.mutate(order.id, {
      onSuccess: () => notice(t.order.cancelled, order.status === 'PAID' ? t.order.cancelConfirmPaid : undefined),
      onError: (e) => {
        notice(err(e));
        void query.refetch();
      },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: fmt(t.order.title, { number: order.number }) }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !awaiting}
            onRefresh={() => void query.refetch()}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
      >
        {query.data?.fromCache ? <Banner text={t.common.offline} icon="cloud-offline-outline" /> : null}

        <Card style={styles.header}>
          <OfferPhoto url={o.template.photoUrl} category={o.template.category} height={56} style={styles.thumb} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.partner}>{o.partner.brandName}</Text>
            <Text style={styles.muted}>
              {o.template.title} · {fmt(t.order.quantityAmount, { q: order.quantity, sum: fmtMoney(t, order.amountKgs) })}
            </Text>
          </View>
          <Badge label={t.order.status[order.status]} tone={statusTone(order.status)} />
        </Card>

        {order.status === 'PENDING_PAYMENT' ? (
          <Card style={{ gap: space.md, alignItems: 'stretch' }}>
            {reservedLeft > 0 ? (
              <>
                <Text style={styles.centerMuted}>{t.order.reservedFor}</Text>
                <Text style={styles.countdown} testID="reservation-countdown">
                  {fmtCountdown(reservedLeft)}
                </Text>
                <Text style={styles.centerMuted}>{t.order.payMethods}</Text>
                {awaiting ? <Banner tone="info" icon="hourglass-outline" text={t.order.checkingPayment} /> : null}
                {payError ? <Banner tone="danger" text={payError} /> : null}
                {!awaiting && autoPayDone.current && !payError ? (
                  <Text style={styles.centerMuted}>{t.order.paymentNotFinished}</Text>
                ) : null}
                <Button
                  testID="pay"
                  title={autoPayDone.current ? t.order.payAgain : fmt(t.order.pay, { sum: fmtMoney(t, order.amountKgs) })}
                  icon="card-outline"
                  loading={startPayment.isPending}
                  onPress={() => {
                    autoPayDone.current = true;
                    void openPayment(order);
                  }}
                />
              </>
            ) : (
              <Banner tone="danger" text={t.order.reservationExpired} />
            )}
          </Card>
        ) : null}

        {isActive && order.qrToken && order.pickupCode ? (
          <Card style={styles.qrCard}>
            <Text style={styles.centerMuted}>{t.order.showAtPickup}</Text>
            <View style={styles.qrBox} testID="qr">
              <QRCode value={order.qrToken} size={220} color={colors.text} backgroundColor={colors.white} quietZone={8} />
            </View>
            <Text style={styles.codeLabel}>{t.order.pickupCode}</Text>
            <Text style={styles.code} testID="pickup-code" selectable>
              {order.pickupCode.slice(0, 3)} {order.pickupCode.slice(3)}
            </Text>
            <WindowStatus now={now} from={from} to={to} />
          </Card>
        ) : null}

        {order.status === 'ISSUED' && order.issuedAt ? (
          <Banner tone="info" icon="checkmark-circle-outline" text={fmt(t.order.issuedAt, { when: fmtDateTime(t, order.issuedAt) })} />
        ) : null}
        {order.cancelReason ? <Banner text={fmt(t.order.cancelReason, { reason: order.cancelReason })} /> : null}
        {order.refundedKgs > 0 ? (
          <Banner tone="info" icon="return-down-back-outline" text={fmt(t.order.refunded, { sum: fmtMoney(t, order.refundedKgs) })} />
        ) : null}

        <Card style={{ gap: space.md }}>
          <Row icon="time-outline">
            <Text style={styles.rowLabel}>{t.offer.pickupWindow}</Text>
            <Text style={styles.rowValue}>{fmtWindow(t, o.pickupFrom, o.pickupTo)}</Text>
          </Row>
          <Row icon="location-outline">
            <Text style={styles.rowLabel}>{t.offer.address}</Text>
            <Text style={styles.rowValue}>
              {o.location.name} · {o.location.address}
            </Text>
            <View style={styles.actionsRow}>
              <Pressable onPress={() => openRoute(o.location.lat, o.location.lng, o.partner.brandName)} style={styles.pill}>
                <Ionicons name="navigate" size={15} color={colors.brandDark} />
                <Text style={styles.pillText}>{t.common.openRoute}</Text>
              </Pressable>
              <Pressable onPress={() => router.push(`/partner/${o.partner.id}`)} style={styles.pill}>
                <Ionicons name="storefront-outline" size={15} color={colors.brandDark} />
                <Text style={styles.pillText}>{t.order.openPartner}</Text>
              </Pressable>
            </View>
          </Row>
        </Card>

        {order.canCancel ? (
          <View style={{ gap: space.xs }}>
            <Button
              testID="cancel-order"
              title={order.status === 'PENDING_PAYMENT' ? t.order.cancelReservation : t.order.cancel}
              variant="danger"
              loading={cancel.isPending}
              onPress={() => void onCancel()}
            />
            {order.status === 'PAID' ? (
              <Text style={styles.centerMuted}>{fmt(t.order.cancelUntil, { when: fmtDateTime(t, order.cancelDeadline) })}</Text>
            ) : null}
          </View>
        ) : isActive ? (
          <Text style={styles.centerMuted}>{fmt(t.order.cancelClosed, { when: fmtDateTime(t, order.cancelDeadline) })}</Text>
        ) : null}

        <ReviewSection order={order} />

        {order.review?.isComplaint ? (
          <Card style={{ gap: 4 }}>
            <Text style={styles.sectionTitle}>
              {t.order.complaintSent}
              {order.review.complaintStatus
                ? ` — ${(t.order.complaintStatus as Record<string, string>)[order.review.complaintStatus] ?? order.review.complaintStatus}`
                : ''}
            </Text>
            {order.review.resolution ? (
              <Text style={styles.muted}>{fmt(t.order.complaintResolution, { text: order.review.resolution })}</Text>
            ) : null}
          </Card>
        ) : null}
        {order.canComplain ? (
          <View style={{ gap: space.xs }}>
            <Button
              title={t.order.complain}
              variant="secondary"
              icon="alert-circle-outline"
              onPress={() => router.push(`/complaint/${order.id}`)}
            />
            <Text style={styles.centerMuted}>{t.order.help}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function WindowStatus({ now, from, to }: { now: number; from: number; to: number }) {
  const { t } = useI18n();
  let text: string;
  let icon: 'hourglass-outline' | 'checkmark-circle' | 'close-circle-outline';
  let sub: string | null = null;
  if (now < from) {
    text = fmt(t.order.startsIn, { t: fmtDuration(t, from - now) });
    sub = fmt(t.order.startsAt, { from: fmtTime(new Date(from)), to: fmtTime(new Date(to)) });
    icon = 'hourglass-outline';
  } else if (now <= to) {
    text = fmt(t.order.goingUntil, { to: fmtTime(new Date(to)) });
    icon = 'checkmark-circle';
  } else {
    text = t.order.windowOver;
    icon = 'close-circle-outline';
  }
  return (
    <View style={styles.window}>
      <Ionicons name={icon} size={20} color={now > to ? colors.danger : colors.brand} />
      <View>
        <Text style={styles.windowText}>{text}</Text>
        {sub ? <Text style={styles.muted}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function ReviewSection({ order }: { order: Order }) {
  const { t, err } = useI18n();
  const review = useReview();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');

  if (order.review?.rating) {
    return (
      <Card style={{ gap: space.sm }}>
        <Text style={styles.sectionTitle}>{t.order.yourReview}</Text>
        <Stars value={order.review.rating} size={22} />
        {order.review.text ? <Text style={styles.muted}>{order.review.text}</Text> : null}
      </Card>
    );
  }
  if (!order.canReview) return null;
  return (
    <Card style={{ gap: space.md }}>
      <Text style={styles.sectionTitle}>{t.order.reviewTitle}</Text>
      <Stars value={rating} size={34} onChange={setRating} />
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={t.order.reviewPlaceholder}
        placeholderTextColor={colors.faint}
        multiline
        maxLength={1000}
        style={styles.textArea}
      />
      <Button
        title={t.order.reviewSend}
        disabled={rating === 0}
        loading={review.isPending}
        onPress={() =>
          review.mutate(
            { orderId: order.id, rating, text: text.trim() },
            { onSuccess: () => notice(t.order.reviewThanks), onError: (e) => notice(err(e)) },
          )
        }
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xl * 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  thumb: { width: 56, borderRadius: radius.md },
  partner: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  centerMuted: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  countdown: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.brandDark,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  qrCard: { alignItems: 'center', gap: space.md },
  qrBox: { padding: space.sm, backgroundColor: colors.white, borderRadius: radius.md },
  codeLabel: { fontSize: 13, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1 },
  code: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: 6,
    color: colors.text,
    fontVariant: ['tabular-nums'],
    marginTop: -space.sm,
  },
  window: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.brandSoft,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    alignSelf: 'stretch',
  },
  windowText: { fontSize: 16, fontWeight: '700', color: colors.text },
  rowLabel: { fontSize: 13, color: colors.muted },
  rowValue: { fontSize: 16, color: colors.text, fontWeight: '500', marginTop: 1 },
  actionsRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.brandSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  pillText: { color: colors.brandDark, fontWeight: '600', fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  textArea: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    fontSize: 15,
    color: colors.text,
    textAlignVertical: 'top',
  },
});
