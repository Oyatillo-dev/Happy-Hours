import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { Manrope_800ExtraBold, useFonts } from '@expo-google-fonts/manrope';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import { AuthProvider } from '@/auth/AuthContext';
import { I18nProvider, useI18n } from '@/i18n';
import { FiltersProvider } from '@/lib/filters';
import { LocationProvider } from '@/lib/location';
import { orderIdOf } from '@/lib/push';
import { colors } from '@/theme';

// Refetch when the app comes back to the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));
}

/** FR-B08: tapping a push with data.orderId opens that order. */
function useNotificationObserver() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (n: Notifications.Notification) => {
      const id = orderIdOf(n);
      if (id) {
        router.push(`/orders/${id}`);
        Notifications.clearLastNotificationResponse();
      }
    };
    const last = Notifications.getLastNotificationResponse();
    if (last?.notification) open(last.notification);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification));
    return () => sub.remove();
  }, []);
}

function RootStack() {
  const { t } = useI18n();
  useNotificationObserver();
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: colors.brandDark,
          headerTitleStyle: { color: colors.text, fontWeight: '700' },
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: t.common.appName }} />
        <Stack.Screen name="login" options={{ presentation: 'modal', title: t.login.title }} />
        <Stack.Screen name="offer/[id]" options={{ title: '' }} />
        <Stack.Screen name="orders/[id]" options={{ title: '' }} />
        <Stack.Screen name="partner/[id]" options={{ title: '' }} />
        <Stack.Screen name="complaint/[id]" options={{ title: t.complaint.title }} />
        <Stack.Screen name="notifications" options={{ title: t.notifications.title }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  // Headings and prices use Manrope (brand book); on a load error the app falls back to the system font.
  const [fontsLoaded, fontError] = useFonts({ Manrope_800ExtraBold });
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (count, error) =>
              count < 2 && (!(error instanceof ApiError) || error.status === 0 || error.status >= 500),
          },
          mutations: { retry: false },
        },
      }),
  );
  if (!fontsLoaded && !fontError) return null;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <AuthProvider>
            <LocationProvider>
              <FiltersProvider>
                <RootStack />
              </FiltersProvider>
            </LocationProvider>
          </AuthProvider>
        </I18nProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
