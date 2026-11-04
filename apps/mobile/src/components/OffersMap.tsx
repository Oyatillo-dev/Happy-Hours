import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useI18n } from '@/i18n';
import { colors } from '@/theme';
import { OffersList } from './OffersList';
import type { LocationGroup } from './mapGroups';

// Google Maps on Android needs an API key in the build (Expo Go brings its own); without
// one the map crashes the app, so such builds show the list instead.
const mapUnavailable =
  Platform.OS === 'android' &&
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient &&
  !Constants.expoConfig?.extra?.googleMapsAndroid;

type Props = {
  groups: LocationGroup[];
  center: { lat: number; lng: number };
  showsUser: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export function OffersMap(props: Props) {
  const { t } = useI18n();
  if (mapUnavailable) return <OffersList {...props} notice={t.map.noMap} />;
  return <NativeMap {...props} />;
}

/** Native map (react-native-maps): one marker per partner location, label = cheapest price. */
function NativeMap({
  groups,
  center,
  showsUser,
  selectedId,
  onSelect,
}: Props) {
  const ref = useRef<MapView>(null);
  const initial: Region = { latitude: center.lat, longitude: center.lng, latitudeDelta: 0.08, longitudeDelta: 0.08 };

  useEffect(() => {
    ref.current?.animateToRegion(
      { latitude: center.lat, longitude: center.lng, latitudeDelta: 0.08, longitudeDelta: 0.08 },
      400,
    );
  }, [center.lat, center.lng]);

  return (
    <MapView
      ref={ref}
      style={StyleSheet.absoluteFill}
      initialRegion={initial}
      showsUserLocation={showsUser}
      showsMyLocationButton={showsUser}
      onPress={() => onSelect(null)}
      toolbarEnabled={false}
    >
      {groups.map((g) => {
        const active = g.location.id === selectedId;
        return (
          <Marker
            key={g.location.id}
            coordinate={{ latitude: g.location.lat, longitude: g.location.lng }}
            onPress={(e) => {
              e.stopPropagation();
              onSelect(g.location.id);
            }}
            tracksViewChanges={false}
          >
            <View style={[styles.pin, active && styles.pinActive, g.available === 0 && styles.pinSold]}>
              <Text style={[styles.pinText, active && { color: colors.brand }]}>{g.label}</Text>
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  pin: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.white,
  },
  pinActive: { backgroundColor: colors.white, borderColor: colors.brand },
  pinSold: { backgroundColor: colors.faint },
  pinText: { color: colors.onPrimary, fontWeight: '800', fontSize: 12 },
});
