/**
 * Bishkek is UTC+6 all year (no DST), so local time is a fixed offset.
 */
export const TZ_OFFSET_MIN = 6 * 60;
const MS_MIN = 60_000;
const MS_DAY = 86_400_000;

/** Local calendar date (YYYY-MM-DD) for an instant. */
export function localDate(at: Date = new Date()): string {
  return new Date(at.getTime() + TZ_OFFSET_MIN * MS_MIN).toISOString().slice(0, 10);
}

/** Instant for a local date + HH:mm. */
export function localDateTime(date: string, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const midnightUtc = Date.parse(`${date}T00:00:00Z`);
  return new Date(midnightUtc + (h * 60 + m - TZ_OFFSET_MIN) * MS_MIN);
}

/** Local HH:mm for an instant. */
export function localTime(at: Date): string {
  return new Date(at.getTime() + TZ_OFFSET_MIN * MS_MIN).toISOString().slice(11, 16);
}

/** ISO weekday 1 (Mon) … 7 (Sun) of a local date. */
export function weekday(date: string): number {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * MS_DAY).toISOString().slice(0, 10);
}

/** Monday of the local week that contains `date`. */
export function weekStart(date: string): string {
  return addDays(date, 1 - weekday(date));
}

export const minutes = (n: number) => n * MS_MIN;
export const hours = (n: number) => n * 60 * MS_MIN;

export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
