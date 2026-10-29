import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFavorites } from '@/api/hooks';
import { useAuth } from '@/auth/AuthContext';
import { HeartButton } from '@/components/HeartButton';
import { LoginPrompt } from '@/components/LoginPrompt';
import { EmptyView, ErrorView, Loading } from '@/components/ui';
import { useI18n } from '@/i18n';
import { fmtRating } from '@/lib/format';
import { colors, radius, space } from '@/theme';

/** FR-B09: favourite partners. */
export default function FavoritesScreen() {
  const { t } = useI18n();
  const { status } = useAuth();
  const favorites = useFavorites();

  if (status === 'guest') return <LoginPrompt icon="heart-outline" />;
  if (favorites.isPending) return <Loading />;
  if (favorites.isError) return <ErrorView error={favorites.error} onRetry={() => void favorites.refetch()} />;

  return (
    <FlatList
      data={favorites.data}
      keyExtractor={(f) => f.partnerId}
      contentContainerStyle={[styles.list, favorites.data.length === 0 && { flexGrow: 1 }]}
      ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
      refreshControl={
        <RefreshControl
          refreshing={favorites.isRefetching}
          onRefresh={() => void favorites.refetch()}
          tintColor={colors.brand}
          colors={[colors.brand]}
        />
      }
      ListEmptyComponent={<EmptyView icon="heart-outline" title={t.favorites.empty} />}
      renderItem={({ item }) => (
        <Pressable style={styles.item} onPress={() => router.push(`/partner/${item.partnerId}`)}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>{item.brandName.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.brandName}</Text>
            <View style={styles.rating}>
              <Ionicons name="star" size={13} color={colors.star} />
              <Text style={styles.muted}>{fmtRating(item.rating)}</Text>
            </View>
          </View>
          <HeartButton partnerId={item.partnerId} active />
        </Pressable>
      )}
    />
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
  logo: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 18, fontWeight: '800', color: colors.brandDark },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  muted: { fontSize: 13, color: colors.muted },
});
