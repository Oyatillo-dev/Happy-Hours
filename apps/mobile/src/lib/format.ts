import { fmt } from '@/i18n';
import type { Dict } from '@/i18n/ru';

/**
 * Bishkek is UTC+6 all year (no DST). Hermes' Intl time zone support is unreliable,
 * so local time is computed by shifting the instant and reading UTC fields.
 */
const OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');
const toLocal = (iso: string | Date) => new Date(new Date(iso).getTime() + OFFSET_MS);

/** "19:30" in Bishkek time. */
export function fmtTime(iso: string | Date): string {
  const d = toLocal(iso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Local calendar day number (days since epoch in Bishkek). */
const localDay = (iso: string | Date) => Math.floor(toLocal(iso).getTime() / DAY_MS);

/** "сегодня" / "завтра" / "29.10". */
export function fmtDay(t: Dict, iso: string | Date, now: Date = new Date()): string {
  const diff = localDay(iso) - localDay(now);
  if (diff === 0) return t.common.today;
  if (diff === 1) return t.common.tomorrow;
  const d = toLocal(iso);
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}`;
}

/** "сегодня 19:30" or "29.10.2026 19:30". */
export function fmtDateTime(t: Dict, iso: string | Date, now: Date = new Date()): string {
  const diff = localDay(iso) - localDay(now);
  if (diff === 0 || diff === 1) return `${fmtDay(t, iso, now)} ${fmtTime(iso)}`;
  const d = toLocal(iso);
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${fmtTime(iso)}`;
}

/** Pickup window "сегодня 19:00–20:30". */
export function fmtWindow(t: Dict, from: string, to: string): string {
  return `${fmtDay(t, from)} ${fmtTime(from)}–${fmtTime(to)}`;
}

/** Whole soms with thin grouping: "1 250 сом". */
export function fmtMoney(t: Dict, amount: number): string {
  const s = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${s} ${t.common.som}`;
}

/** "1 ч 20 мин" / "15 мин" (rounded up to a minute). */
export function fmtDuration(t: Dict, ms: number): string {
  const total = Math.max(1, Math.ceil(ms / 60_000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? fmt(t.time.hm, { h, m }) : fmt(t.time.m, { m });
}

/** "09:41" countdown (mm:ss). */
export function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

export const discountPct = (price: number, value: number) =>
  value > 0 ? Math.round((1 - price / value) * 100) : 0;

/** "+996 700 000 010". */
export function fmtPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('996')) return `+996 ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}`;
  return phone;
}

/**
 * What the login field shows after its fixed +996: the local digits grouped by three
 * ("700 123 456"). A pasted full number (+996…, 0…) keeps only its local part.
 */
export function formatLocalPhone(input: string) {
  let d = input.replace(/\D/g, '');
  if (d.startsWith('996') && d.length > 9) d = d.slice(3);
  else if (d.startsWith('0') && d.length > 9) d = d.slice(1);
  return d.slice(0, 9).replace(/(\d{3})(?=\d)/g, '$1 ');
}

/** Same rules as the API's normalizePhone: returns +996XXXXXXXXX or null. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (/^996\d{9}$/.test(digits)) return `+${digits}`;
  if (/^0\d{9}$/.test(digits)) return `+996${digits.slice(1)}`;
  if (/^\d{9}$/.test(digits)) return `+996${digits}`;
  return null;
}

export const fmtRating = (r: number | null | undefined) => (r == null ? '—' : r.toFixed(1).replace('.', ','));
