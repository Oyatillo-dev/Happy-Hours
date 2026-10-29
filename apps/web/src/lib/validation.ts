// Client-side mirrors of the API's business rules (apps/api/src/config.ts → rules).
import { nowMinutes, toMinutes, today } from './format';

export const rules = {
  minPriceKgs: 100,
  minValueMultiplier: 2,
  minWindowMinutes: 30,
  maxWindowMinutes: 180,
  maxWeightKg: 20,
  maxQuantity: 500,
};

export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const INN = /^\d{14}$/;

export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (/^996\d{9}$/.test(digits)) return `+${digits}`;
  if (/^0\d{9}$/.test(digits)) return `+996${digits.slice(1)}`;
  if (/^\d{9}$/.test(digits)) return `+996${digits}`;
  return null;
}

/** Returns an i18n error key or null. */
export function priceError(price: number, value: number): 'err.price_too_low' | 'err.value_too_low' | null {
  if (!Number.isFinite(price) || price < rules.minPriceKgs) return 'err.price_too_low';
  if (!Number.isFinite(value) || value < price * rules.minValueMultiplier) return 'err.value_too_low';
  return null;
}

export type WindowErrorKey =
  | 'err.invalid_time'
  | 'err.invalid_window_length'
  | 'err.window_outside_hours'
  | 'err.window_in_past';

export function windowError(
  location: { openTime: string; closeTime: string } | undefined,
  from: string,
  to: string,
  date?: string,
): WindowErrorKey | null {
  if (!HHMM.test(from) || !HHMM.test(to)) return 'err.invalid_time';
  const length = toMinutes(to) - toMinutes(from);
  if (length < rules.minWindowMinutes || length > rules.maxWindowMinutes) return 'err.invalid_window_length';
  if (location && (toMinutes(from) < toMinutes(location.openTime) || toMinutes(to) > toMinutes(location.closeTime))) {
    return 'err.window_outside_hours';
  }
  if (date && date === today() && toMinutes(to) <= nowMinutes()) return 'err.window_in_past';
  return null;
}
