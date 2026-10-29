import { describe, expect, it } from 'vitest';
import { normalizePhone } from '../src/lib/codes.js';
import { addDays, localDate, localDateTime, localTime, weekStart, weekday } from '../src/lib/time.js';

describe('Bishkek time helpers', () => {
  it('converts between local and UTC with the +6 offset', () => {
    const at = localDateTime('2026-10-29', '20:00');
    expect(at.toISOString()).toBe('2026-10-29T14:00:00.000Z');
    expect(localTime(at)).toBe('20:00');
    // 19:30 UTC is already the next day in Bishkek
    expect(localDate(new Date('2026-10-29T19:30:00Z'))).toBe('2026-10-30');
  });

  it('computes weekdays and week starts', () => {
    expect(weekday('2026-10-26')).toBe(1); // Monday
    expect(weekday('2026-11-01')).toBe(7); // Sunday
    expect(weekStart('2026-11-01')).toBe('2026-10-26');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('phone normalisation', () => {
  it('accepts common Kyrgyz formats', () => {
    expect(normalizePhone('+996 555 12-34-56')).toBe('+996555123456');
    expect(normalizePhone('0555123456')).toBe('+996555123456');
    expect(normalizePhone('555123456')).toBe('+996555123456');
    expect(normalizePhone('12345')).toBeNull();
  });
});
