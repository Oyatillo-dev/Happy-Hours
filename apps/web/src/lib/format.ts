/** Bishkek is UTC+6 all year. All display uses this zone regardless of the device's clock settings. */
export const TZ = 'Asia/Bishkek';
const TZ_OFFSET_MS = 6 * 60 * 60_000;

const moneyFmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

/** 1250 → "1 250 сом" */
export const money = (kgs: number | null | undefined) =>
  kgs === null || kgs === undefined ? '—' : `${moneyFmt.format(kgs).replace(/\s/g, ' ')} сом`;

export const num = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : numFmt.format(n).replace(/\s/g, ' ');

export const pct = (n: number) => `${numFmt.format(n)}%`;

const locale = (lang: string) => (lang === 'ky' ? 'ky-KG' : 'ru-RU');

/** HH:mm in Bishkek time for an ISO instant. */
export function time(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(new Date(iso).getTime() + TZ_OFFSET_MS).toISOString().slice(11, 16);
}

export function dateTime(iso: string | null | undefined, lang = 'ru') {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(locale(lang), {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function dateOnly(iso: string | null | undefined, lang = 'ru') {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(locale(lang), { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(iso),
  );
}

/** "2026-10-29" → "29.10.2026" */
export function localDateLabel(date: string) {
  const [y, m, d] = date.split('-');
  return `${d}.${m}.${y}`;
}

/** "2026-10-29" → "29.10" */
export const shortDate = (date: string) => localDateLabel(date).slice(0, 5);

/** Today's local Bishkek date, YYYY-MM-DD. */
export function today(now = new Date()) {
  return new Date(now.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

/** Current Bishkek time as minutes since midnight. */
export function nowMinutes(now = new Date()) {
  const d = new Date(now.getTime() + TZ_OFFSET_MS);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** ISO weekday 1 (Mon) … 7 (Sun) */
export function weekday(date: string) {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

export const weekStart = (date: string) => addDays(date, 1 - weekday(date));

export function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function fromMinutes(min: number) {
  const m = Math.max(0, Math.min(min, 23 * 60 + 59));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Shows +996 700 000 002 */
export function phone(p: string | null | undefined) {
  if (!p) return '—';
  const m = /^\+996(\d{3})(\d{3})(\d{3})$/.exec(p);
  return m ? `+996 ${m[1]} ${m[2]} ${m[3]}` : p;
}

/** Fills a daily series so every date in [from, to] is present (the API omits empty days). */
export function fillDays<T extends { date: string }>(from: string, to: string, rows: T[], empty: (date: string) => T): T[] {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const out: T[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(byDate.get(d) ?? empty(d));
  return out;
}
