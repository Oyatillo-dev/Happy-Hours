import type { ExpoConfig } from 'expo/config';

const BRAND = '#b5d92b';
// EAS project on expo.dev (team oyatilloss-team); used for EAS Update and push tokens.
const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? '7b1d4887-8d8d-4012-9e09-c4834dae8358';

const config: ExpoConfig = {
  name: 'Sakta',
  slug: 'happy-hours',
  owner: 'oyatilloss-team',
  scheme: 'sakta',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  primaryColor: BRAND,
  ios: {
    bundleIdentifier: 'kg.sakta.app',
    supportsTablet: false,
    infoPlist: {
      // Lets the app check whether the 2GIS app is installed for "open route".
      LSApplicationQueriesSchemes: ['dgis'],
    },
  },
  android: {
    package: 'kg.sakta.app',
    adaptiveIcon: {
      backgroundColor: '#b5d92b',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'CAMERA', 'POST_NOTIFICATIONS'],
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
    output: 'single',
  },
  plugins: [
    'expo-router',
    'expo-status-bar',
    'expo-web-browser',
    'expo-secure-store',
    'expo-font',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Sakta использует ваше местоположение, чтобы показать боксы в ближайших кафе и пекарнях.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Разрешите доступ к фото, чтобы приложить снимок к жалобе на заказ.',
        cameraPermission: 'Разрешите доступ к камере, чтобы сфотографировать заказ для жалобы.',
      },
    ],
    [
      'expo-notifications',
      {
        color: BRAND,
      },
    ],
    [
      'react-native-maps',
      {
        // Required for Google Maps in Android builds (not needed in Expo Go).
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
      },
    ],
  ],
  // EAS Update: testers open published builds of the JS in Expo Go, so the runtime is tied to
  // the Expo SDK version that Expo Go ships with.
  runtimeVersion: { policy: 'sdkVersion' },
  updates: { url: `https://u.expo.dev/${easProjectId}` },
  experiments: {
    typedRoutes: false,
  },
  extra: {
    eas: { projectId: easProjectId },
    // Read by OffersMap: Android builds without a key show a list instead of the map.
    googleMapsAndroid: !!process.env.GOOGLE_MAPS_ANDROID_API_KEY,
  },
};

export default config;
