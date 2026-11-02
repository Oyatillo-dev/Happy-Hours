import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, type OfferFilters, type SortMode } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n';
import { DEFAULT_FILTERS, useFilters } from '@/lib/filters';
import { fmtMoney } from '@/lib/format';
import { colors, radius, shadow, space } from '@/theme';
import { Button, Chip } from './ui';

const PRICES = [150, 200, 300, 500];
const AFTER = ['12:00', '15:00', '18:00', '20:00'];
const BEFORE = ['14:00', '17:00', '19:00', '21:00'];
const RADII = [2, 5, 10, 25];

/** Search + category chips + "filters" button (FR-B02). */
export function FiltersBar({ showSearch = true }: { showSearch?: boolean }) {
  const { t } = useI18n();
  const { status } = useAuth();
  const { filters, setFilters, activeCount } = useFilters();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(filters.q ?? '');

  return (
    <View style={styles.wrap}>
      {showSearch ? (
        <View style={styles.searchRow}>
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={colors.faint} />
            <TextInput
              value={q}
              onChangeText={setQ}
              onSubmitEditing={() => setFilters((f) => ({ ...f, q: q.trim() || undefined }))}
              onBlur={() => setFilters((f) => ({ ...f, q: q.trim() || undefined }))}
              placeholder={t.feed.searchPlaceholder}
              placeholderTextColor={colors.faint}
              returnKeyType="search"
              style={styles.searchInput}
            />
            {q ? (
              <Pressable
                hitSlop={8}
                onPress={() => {
                  setQ('');
                  setFilters((f) => ({ ...f, q: undefined }));
                }}
              >
                <Ionicons name="close-circle" size={18} color={colors.faint} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.feed.filters}
            onPress={() => setOpen(true)}
            style={[styles.filterBtn, activeCount > 0 && styles.filterBtnActive]}
          >
            <Ionicons name="options-outline" size={20} color={activeCount > 0 ? colors.white : colors.text} />
            {activeCount > 0 ? <Text style={styles.filterCount}>{activeCount}</Text> : null}
          </Pressable>
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {!showSearch ? (
          <Chip label={t.feed.filters} icon="options-outline" active={activeCount > 0} onPress={() => setOpen(true)} />
        ) : null}
        <Chip
          label={t.feed.all}
          active={!filters.category && !filters.favorites}
          onPress={() => setFilters((f) => ({ ...f, category: undefined, favorites: undefined }))}
        />
        {status === 'authed' ? (
          <Chip
            label={t.feed.favorites}
            icon={filters.favorites ? 'heart' : 'heart-outline'}
            active={!!filters.favorites}
            onPress={() => setFilters((f) => ({ ...f, favorites: f.favorites ? undefined : true }))}
          />
        ) : null}
        {CATEGORIES.map((c) => (
          <Chip
            key={c}
            label={t.category[c]}
            active={filters.category === c}
            onPress={() => setFilters((f) => ({ ...f, category: f.category === c ? undefined : c }))}
          />
        ))}
      </ScrollView>
      <FiltersModal visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}

function FiltersModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { filters, setFilters } = useFilters();
  const [draft, setDraft] = useState<OfferFilters>(filters);
  const set = (patch: Partial<OfferFilters>) => setDraft((d) => ({ ...d, ...patch }));

  const sorts: { key: SortMode; label: string }[] = [
    { key: 'pickup', label: t.filters.sortPickup },
    { key: 'distance', label: t.filters.sortDistance },
    { key: 'price', label: t.filters.sortPrice },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onShow={() => setDraft(filters)}
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>{t.filters.title}</Text>
          <Pressable hitSlop={10} onPress={onClose} accessibilityLabel={t.common.close}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ gap: space.lg }}>
          <Group title={t.filters.sort}>
            {sorts.map((s) => (
              <Chip key={s.key} label={s.label} active={draft.sort === s.key} onPress={() => set({ sort: s.key })} />
            ))}
          </Group>
          <Group title={t.filters.maxPrice}>
            <Chip label={t.filters.any} active={!draft.maxPrice} onPress={() => set({ maxPrice: undefined })} />
            {PRICES.map((p) => (
              <Chip key={p} label={fmtMoney(t, p)} active={draft.maxPrice === p} onPress={() => set({ maxPrice: p })} />
            ))}
          </Group>
          <Group title={t.filters.pickupAfter}>
            <Chip label={t.filters.anyTime} active={!draft.pickupAfter} onPress={() => set({ pickupAfter: undefined })} />
            {AFTER.map((h) => (
              <Chip key={h} label={h} active={draft.pickupAfter === h} onPress={() => set({ pickupAfter: h })} />
            ))}
          </Group>
          <Group title={t.filters.pickupBefore}>
            <Chip label={t.filters.anyTime} active={!draft.pickupBefore} onPress={() => set({ pickupBefore: undefined })} />
            {BEFORE.map((h) => (
              <Chip key={h} label={h} active={draft.pickupBefore === h} onPress={() => set({ pickupBefore: h })} />
            ))}
          </Group>
          <Group title={t.filters.radius}>
            {RADII.map((r) => (
              <Chip
                key={r}
                label={`${r} ${t.common.km}`}
                active={draft.radiusKm === r}
                onPress={() => set({ radiusKm: r })}
              />
            ))}
          </Group>
        </ScrollView>
        <View style={styles.sheetActions}>
          <Button
            title={t.filters.reset}
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() =>
              setDraft((d) => ({ ...DEFAULT_FILTERS, category: d.category, favorites: d.favorites, q: d.q }))
            }
          />
          <Button
            title={t.filters.apply}
            style={{ flex: 2 }}
            onPress={() => {
              setFilters(draft);
              onClose();
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.groupChips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm, paddingTop: space.sm, paddingBottom: space.sm, backgroundColor: colors.bg },
  searchRow: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.inset,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    height: 48,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 0 },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    ...shadow.raiseSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  filterCount: {
    position: 'absolute',
    top: 4,
    right: 5,
    fontSize: 10,
    fontWeight: '800',
    color: colors.white,
  },
  chips: { gap: space.sm, paddingHorizontal: space.lg },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: space.lg,
    maxHeight: '85%',
    gap: space.lg,
  },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  sheetActions: { flexDirection: 'row', gap: space.sm },
  groupTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  groupChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
