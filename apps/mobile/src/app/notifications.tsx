import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useMarkRead, useNotifications } from '@/api/hooks';
import type { AppNotification } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { LoginPrompt } from '@/components/LoginPrompt';
import { EmptyView, ErrorView, Loading } from '@/components/ui';
import { useI18n } from '@/i18n';
import { fmtDateTime } from '@/lib/format';
import { colors, radius, space } from '@/theme';

/** FR-B08: in-app notification list. */
export default function NotificationsScreen() {
  const { t } = useI18n();
  const { status } = useAuth();
  const list = useNotifications();
  const markRead = useMarkRead();

  if (status === 'guest') return <LoginPrompt icon="notifications-outline" />;
  if (list.isPending) return <Loading />;
  if (list.isError) return <ErrorView error={list.error} onRetry={() => void list.refetch()} />;

  const open = (n: AppNotification) => {
    if (!n.readAt) markRead.mutate([n.id]);
    const orderId = n.data?.orderId;
    if (typeof orderId === 'string') router.push(`/orders/${orderId}`);
    else if (typeof n.data?.offerId === 'string') router.push(`/offer/${n.data.offerId}`);
    else if (typeof n.data?.partnerId === 'string') router.push(`/partner/${n.data.partnerId}`);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () =>
            list.data.unread > 0 ? (
              <Pressable onPress={() => markRead.mutate(undefined)} hitSlop={8}>
                <Text style={styles.readAll}>{t.notifications.readAll}</Text>
              </Pressable>
            ) : null,
        }}
      />
      <FlatList
        data={list.data.items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={[styles.list, list.data.items.length === 0 && { flexGrow: 1 }]}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        refreshControl={
          <RefreshControl
            refreshing={list.isRefetching}
            onRefresh={() => void list.refetch()}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
        ListEmptyComponent={<EmptyView icon="notifications-off-outline" title={t.notifications.empty} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => open(item)} style={[styles.item, !item.readAt && styles.unread]}>
            <View style={[styles.dot, !item.readAt && { backgroundColor: colors.brand }]} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.time}>{fmtDateTime(t, item.createdAt)}</Text>
            </View>
            {item.data?.orderId ? <Ionicons name="chevron-forward" size={18} color={colors.faint} /> : null}
          </Pressable>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.card,
    padding: space.md,
    borderRadius: radius.lg,
  },
  unread: { borderWidth: 1, borderColor: colors.sky },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'transparent' },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  body: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  time: { fontSize: 12, color: colors.faint },
  readAll: { color: colors.brandDark, fontWeight: '600', fontSize: 14 },
});
