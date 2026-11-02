import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow } from '@/theme';
import type { IconName } from './ui';

/** Icon pair (inactive, active) per tab route. */
const ICONS: Record<string, [IconName, IconName]> = {
  index: ['home-outline', 'home'],
  favorites: ['heart-outline', 'heart'],
  map: ['map-outline', 'map'],
  orders: ['bag-handle-outline', 'bag-handle'],
  profile: ['person-outline', 'person'],
};

/** The tab drawn as a raised round button in the middle of the bar. */
const CENTER = 'map';

/** Floating soft tab bar with a raised centre action. */
export function TabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const options = descriptors[route.key]?.options ?? {};
          const focused = state.index === index;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const [idle, active] = ICONS[route.name] ?? ['ellipse-outline', 'ellipse'];
          const badge = options.tabBarBadge;
          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          const center = route.name === CENTER;
          return (
            <Pressable
              key={route.key}
              testID={`tab-${route.name}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={onPress}
              style={styles.item}
            >
              {center ? (
                <View style={[styles.centerButton, focused && styles.centerButtonFocused]}>
                  <Ionicons name={focused ? active : idle} size={24} color={colors.white} />
                </View>
              ) : (
                <View>
                  <Ionicons name={focused ? active : idle} size={23} color={focused ? colors.brand : colors.muted} />
                  {badge !== undefined ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{badge}</Text>
                    </View>
                  ) : null}
                </View>
              )}
              <Text
                numberOfLines={1}
                style={[styles.label, focused && styles.labelFocused, center && styles.labelCenter]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { backgroundColor: colors.bg, paddingHorizontal: 14, paddingTop: 8 },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 72,
    paddingBottom: 10,
    borderRadius: radius.lg + 6,
    backgroundColor: colors.card,
    ...shadow.raise,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  centerButton: {
    width: 58,
    height: 58,
    marginTop: -34,
    borderRadius: 29,
    borderWidth: 5,
    borderColor: colors.card,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.glow,
  },
  centerButtonFocused: { backgroundColor: colors.brandDark },
  label: { fontSize: 11, fontWeight: '600', color: colors.muted },
  labelFocused: { color: colors.brand, fontWeight: '800' },
  labelCenter: { color: colors.text, fontWeight: '800' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#c2410c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },
});
