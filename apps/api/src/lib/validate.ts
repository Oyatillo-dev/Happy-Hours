import { z } from 'zod';
import { HHMM } from './time.js';

export const parse = <T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> => schema.parse(data);

export const hhmm = z.string().regex(HHMM, 'Expected HH:mm');
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
export const idParam = z.object({ id: z.string().min(1) });
export const pagination = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
