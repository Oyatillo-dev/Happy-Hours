import { useI18n } from '@/i18n';
import { OffersList } from './OffersList';
import type { LocationGroup } from './mapGroups';

/** react-native-maps has no web implementation. The web build (used for demos/tests) shows a list. */
export function OffersMap(props: {
  groups: LocationGroup[];
  center: { lat: number; lng: number };
  showsUser: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { t } = useI18n();
  return <OffersList {...props} notice={t.map.webFallback} />;
}
