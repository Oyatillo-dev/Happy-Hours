import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useOffers } from '@/api/hooks';
import { FiltersBar } from '@/components/Filters';
import { OfferCard } from '@/components/OfferCard';
import { Banner, Button, EmptyView, ErrorView, Loading } from '@/components/ui';
import { useI18n } from '@/i18n';
import { DEFAULT_FILTERS, useFilters } from '@/lib/filters';
import { useUserLocation } from '@/lib/location';
import { colors, space } from '@/theme';

/** FR-B02: today's boxes near the buyer (list view). Works without login. */
export default function FeedScreen() {
  const { t } = useI18n();
  const location = useUserLocation();
  const { filters, setFilters, activeCount } = useFilters();
  const offers = useOffers(filters, location);
  const items = offers.data?.items ?? [];
  const filtered = activeCount > 0 || !!filters.category || !!filters.favorites || !!filters.q;

  return (
    <View style={styles.screen}>
      <FiltersBar />
      {location.ready && !location.precise ? (
        <View style={styles.banner}>
          <Banner text={t.feed.locationDenied} icon="navigate-outline" />
        </View>
      ) : null}
      {!location.ready || (offers.isPending && offers.fetchStatus !== 'idle') ? (
        <Loading />
      ) : offers.isError && !offers.data ? (
        <ErrorView error={offers.error} onRetry={() => void offers.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(o) => o.id}
          renderItem={({ item }) => <OfferCard offer={item} />}
          contentContainerStyle={[styles.list, items.length === 0 && { flexGrow: 1 }]}
          ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
          refreshControl={
            <RefreshControl
              refreshing={offers.isRefetching}
              onRefresh={() => {
                location.refresh();
                void offers.refetch();
              }}
              tintColor={colors.brand}
              colors={[colors.brand]}
            />
          }
          ListEmptyComponent={
            <EmptyView
              icon="basket-outline"
              title={filters.favorites ? t.feed.emptyFavorites : t.feed.empty}
              hint={t.feed.emptyHint}
              action={
                filtered ? (
                  <Button title={t.feed.resetFilters} variant="secondary" onPress={() => setFilters(DEFAULT_FILTERS)} />
                ) : undefined
              }
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  banner: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  list: { padding: space.lg, paddingTop: space.xs },
});
