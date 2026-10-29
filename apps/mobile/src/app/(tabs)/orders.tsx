import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useOrders } from '@/api/hooks';
import { useAuth } from '@/auth/AuthContext';
import { LoginPrompt } from '@/components/LoginPrompt';
import { OrderRow } from '@/components/OrderRow';
import { Banner, Button, EmptyView, ErrorView, Loading } from '@/components/ui';
import { useI18n } from '@/i18n';
import { colors, radius, space } from '@/theme';

/** FR-B11: active orders and history. */
export default function OrdersScreen() {
  const { t } = useI18n();
  const { status } = useAuth();
  const [scope, setScope] = useState<'active' | 'history'>('active');
  const orders = useOrders(scope);

  if (status === 'loading') return <Loading />;
  if (status === 'guest') return <LoginPrompt icon="bag-handle-outline" />;

  const items = orders.data?.data ?? [];
  return (
    <View style={styles.screen}>
      <View style={styles.segment}>
        {(['active', 'history'] as const).map((s) => (
          <Pressable
            key={s}
            onPress={() => setScope(s)}
            style={[styles.segItem, scope === s && styles.segActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: scope === s }}
          >
            <Text style={[styles.segText, scope === s && styles.segTextActive]}>
              {s === 'active' ? t.orders.active : t.orders.history}
            </Text>
          </Pressable>
        ))}
      </View>
      {orders.data?.fromCache ? (
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
          <Banner text={t.common.offline} icon="cloud-offline-outline" />
        </View>
      ) : null}
      {orders.isPending ? (
        <Loading />
      ) : orders.isError ? (
        <ErrorView error={orders.error} onRetry={() => void orders.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(o) => o.id}
          renderItem={({ item }) => <OrderRow order={item} />}
          ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
          contentContainerStyle={[styles.list, items.length === 0 && { flexGrow: 1 }]}
          refreshControl={
            <RefreshControl
              refreshing={orders.isRefetching}
              onRefresh={() => void orders.refetch()}
              tintColor={colors.brand}
              colors={[colors.brand]}
            />
          }
          ListEmptyComponent={
            scope === 'active' ? (
              <EmptyView
                icon="bag-handle-outline"
                title={t.orders.emptyActive}
                hint={t.orders.emptyActiveHint}
                action={<Button title={t.orders.findBoxes} onPress={() => router.navigate('/')} />}
              />
            ) : (
              <EmptyView icon="time-outline" title={t.orders.emptyHistory} />
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  segment: {
    flexDirection: 'row',
    margin: space.lg,
    marginBottom: space.md,
    backgroundColor: '#e6ebe7',
    borderRadius: radius.md,
    padding: 3,
  },
  segItem: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center' },
  segActive: { backgroundColor: colors.card },
  segText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  segTextActive: { color: colors.text },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xl },
});
