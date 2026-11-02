import { Tabs } from 'expo-router/js-tabs';
import { useNotifications } from '@/api/hooks';
import { TabBar } from '@/components/TabBar';
import { useI18n } from '@/i18n';
import { colors, fonts } from '@/theme';

export default function TabsLayout() {
  const { t } = useI18n();
  const notifications = useNotifications();
  const unread = notifications.data?.unread ?? 0;
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t.tabs.feed, headerTitle: t.feed.title }} />
      <Tabs.Screen name="favorites" options={{ title: t.tabs.favorites, headerTitle: t.favorites.title }} />
      <Tabs.Screen name="map" options={{ title: t.tabs.map }} />
      <Tabs.Screen name="orders" options={{ title: t.tabs.orders }} />
      <Tabs.Screen name="profile" options={{ title: t.tabs.profile, tabBarBadge: unread > 0 ? unread : undefined }} />
    </Tabs>
  );
}
