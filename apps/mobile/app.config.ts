import type { ExpoConfig } from 'expo/config';

const BRAND = '#1f8a4c';
const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

const config: ExpoConfig = {
  name: 'Happy Hours',
  slug: 'happy-hours',
  scheme: 'happyhours',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  primaryColor: BRAND,
  ios: {
    bundleIdentifier: 'kg.happyhours.app',
    supportsTablet: false,
    infoPlist: {
      // Lets the app check whether the 2GIS app is installed for "open route".
      LSApplicationQueriesSchemes: ['dgis'],
    },
  },
  android: {
    package: 'kg.happyhours.app',
    adaptiveIcon: {
      backgroundColor: '#E8F5EC',
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
          'Happy Hours использует ваше местоположение, чтобы показать боксы в ближайших кафе и пекарнях.',
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
  experiments: {
    typedRoutes: false,
  },
  extra: {
    ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
  },
};

export default config;
