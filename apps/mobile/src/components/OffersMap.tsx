import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { colors } from '@/theme';
import type { LocationGroup } from './mapGroups';

/** Native map (react-native-maps): one marker per partner location, label = cheapest price. */
export function OffersMap({
  groups,
  center,
  showsUser,
  selectedId,
  onSelect,
}: {
  groups: LocationGroup[];
  center: { lat: number; lng: number };
  showsUser: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
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
    backgroundColor: colors.brand,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.white,
  },
  pinActive: { backgroundColor: colors.white, borderColor: colors.brand },
  pinSold: { backgroundColor: colors.faint },
  pinText: { color: colors.white, fontWeight: '800', fontSize: 12 },
});
