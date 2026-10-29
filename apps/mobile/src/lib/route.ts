import { Linking, Platform } from 'react-native';

/**
 * FR-B03: "open route". Prefers the 2GIS app, then the 2GIS website (which also hands off to
 * the app via universal links), and falls back to the platform maps app.
 */
export async function openRoute(lat: number, lng: number, label?: string) {
  const dgisApp = `dgis://2gis.ru/routeSearch/rsType/car/to/${lng},${lat}`;
  const dgisWeb = `https://2gis.kg/bishkek/geo/${lng},${lat}`;
  const fallback =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${lat},${lng}`
      : Platform.OS === 'android'
        ? `geo:${lat},${lng}?q=${lat},${lng}${label ? `(${encodeURIComponent(label)})` : ''}`
        : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  if (Platform.OS !== 'web') {
    try {
      if (await Linking.canOpenURL(dgisApp)) {
        await Linking.openURL(dgisApp);
        return;
      }
    } catch {
      // not installed / not declared — continue
    }
  }
  try {
    await Linking.openURL(dgisWeb);
  } catch {
    await Linking.openURL(fallback).catch(() => undefined);
  }
}
