import { createHash, randomBytes, randomInt } from 'node:crypto';

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** 6-digit pickup code shown to the buyer (FR-B06). */
export const pickupCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/** Opaque token encoded in the buyer's QR code. */
export const qrToken = () => randomBytes(18).toString('base64url');

export const otpCode = () => String(randomInt(0, 10_000)).padStart(4, '0');

export const refreshToken = () => randomBytes(32).toString('base64url');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Human friendly order number, e.g. HH-7K3QX9. */
export function orderNumber() {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHABET[randomInt(0, ALPHABET.length)];
  return `HH-${s}`;
}

/** Normalises Kyrgyz phone numbers to +996XXXXXXXXX. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (/^996\d{9}$/.test(digits)) return `+${digits}`;
  if (/^0\d{9}$/.test(digits)) return `+996${digits.slice(1)}`;
  if (/^\d{9}$/.test(digits)) return `+996${digits}`;
  return null;
}
