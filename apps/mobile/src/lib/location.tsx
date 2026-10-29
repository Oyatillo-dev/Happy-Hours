import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

/** Bishkek city centre — used when location permission is denied or unavailable. */
export const BISHKEK = { lat: 42.8746, lng: 74.5698 };

export interface UserLocation {
  lat: number;
  lng: number;
  /** false when we fell back to the city centre. */
  precise: boolean;
  ready: boolean;
  refresh: () => void;
}

const LocationContext = createContext<UserLocation | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({ ...BISHKEK, precise: false, ready: false });

  const load = useCallback(async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setState({ ...BISHKEK, precise: false, ready: true });
        return;
      }
      // A last known position makes the first feed load fast; then refine.
      const last = await Location.getLastKnownPositionAsync().catch(() => null);
      if (last) setState({ lat: last.coords.latitude, lng: last.coords.longitude, precise: true, ready: true });
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setState({ lat: pos.coords.latitude, lng: pos.coords.longitude, precise: true, ready: true });
    } catch {
      setState((s) => (s.precise ? { ...s, ready: true } : { ...BISHKEK, precise: false, ready: true }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <LocationContext.Provider value={{ ...state, refresh: () => void load() }}>{children}</LocationContext.Provider>
  );
}

export function useUserLocation(): UserLocation {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useUserLocation must be used inside LocationProvider');
  return ctx;
}
