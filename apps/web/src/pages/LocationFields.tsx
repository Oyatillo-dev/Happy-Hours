import type { LocationInput } from '../api/types';
import { Field } from '../components/ui';
import { useI18n, type DictKey } from '../i18n';
import { toMinutes } from '../lib/format';
import { HHMM } from '../lib/validation';

export interface LocationDraft {
  name: string;
  address: string;
  lat: string;
  lng: string;
  openTime: string;
  closeTime: string;
}

export const emptyLocation: LocationDraft = {
  name: '',
  address: '',
  lat: '42.8746',
  lng: '74.5698',
  openTime: '09:00',
  closeTime: '21:00',
};

export type LocationErrors = Partial<Record<keyof LocationDraft, DictKey>>;

export function validateLocation(d: LocationDraft): LocationErrors {
  const e: LocationErrors = {};
  if (!d.name.trim()) e.name = 'err.required';
  if (d.address.trim().length < 3) e.address = 'err.required';
  const lat = Number(d.lat.replace(',', '.'));
  const lng = Number(d.lng.replace(',', '.'));
  if (!d.lat || !Number.isFinite(lat) || lat < 42 || lat > 43.2) e.lat = 'err.invalid_coords';
  if (!d.lng || !Number.isFinite(lng) || lng < 74 || lng > 75.2) e.lng = 'err.invalid_coords';
  if (!HHMM.test(d.openTime)) e.openTime = 'err.invalid_time';
  if (!HHMM.test(d.closeTime)) e.closeTime = 'err.invalid_time';
  else if (HHMM.test(d.openTime) && toMinutes(d.closeTime) <= toMinutes(d.openTime)) e.closeTime = 'err.hours_invalid';
  return e;
}

export function toLocationInput(d: LocationDraft): LocationInput {
  return {
    name: d.name.trim(),
    address: d.address.trim(),
    lat: Number(d.lat.replace(',', '.')),
    lng: Number(d.lng.replace(',', '.')),
    openTime: d.openTime,
    closeTime: d.closeTime,
  };
}

export function LocationFields({
  value,
  onChange,
  errors,
}: {
  value: LocationDraft;
  onChange: (v: LocationDraft) => void;
  errors: LocationErrors;
}) {
  const { t } = useI18n();
  const set = (k: keyof LocationDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [k]: e.target.value });
  const err = (k: keyof LocationDraft) => (errors[k] ? t(errors[k]!) : null);
  return (
    <div className="grid-2">
      <Field label={t('location.name')} error={err('name')}>
        <input className="input" value={value.name} maxLength={80} onChange={set('name')} />
      </Field>
      <Field label={t('location.address')} error={err('address')}>
        <input className="input" value={value.address} maxLength={200} onChange={set('address')} />
      </Field>
      <Field label={t('location.lat')} error={err('lat')}>
        <input className="input" inputMode="decimal" value={value.lat} onChange={set('lat')} />
      </Field>
      <Field label={t('location.lng')} error={err('lng')}>
        <input className="input" inputMode="decimal" value={value.lng} onChange={set('lng')} />
      </Field>
      <p className="muted small span-2">{t('location.coordsHint')}</p>
      <Field label={t('location.openTime')} error={err('openTime')}>
        <input className="input" type="time" value={value.openTime} onChange={set('openTime')} />
      </Field>
      <Field label={t('location.closeTime')} error={err('closeTime')}>
        <input className="input" type="time" value={value.closeTime} onChange={set('closeTime')} />
      </Field>
    </div>
  );
}
