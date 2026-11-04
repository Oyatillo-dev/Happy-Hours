import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from '@/api/client';
import { colors } from '@/theme';

export type PushResult = 'registered' | 'denied' | 'unsupported' | 'failed';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * FR-B08: asks for permission, obtains an Expo push token and sends it to the API.
 * Every failure is non-fatal: the app works without push, and orders are still visible in-app.
 * Real tokens need a physical device and an EAS projectId (dev build / EAS build);
 * Expo Go on Android no longer supports remote push.
 */
export async function registerForPush(): Promise<PushResult> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unsupported';
  if (Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return 'unsupported';
  }
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Sakta',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: colors.brand,
      });
    }
    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted' && current.canAskAgain) {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return 'denied';

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
      Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await api('POST', '/me/push-tokens', { body: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' } });
    return 'registered';
  } catch (e) {
    if (__DEV__) console.warn('[push] registration failed', e);
    return 'failed';
  }
}

/** Order id carried by a notification (server sends data.orderId). */
export function orderIdOf(notification: Notifications.Notification): string | null {
  const id = (notification.request.content.data as Record<string, unknown> | undefined)?.orderId;
  return typeof id === 'string' ? id : null;
}
