import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  PUBLIC_URL: z.string().url().default('http://localhost:4000'),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(8),
  PAYMENT_WEBHOOK_SECRET: z.string().min(8),
  ADMIN_PHONES: z.string().default(''),
  SMS_PROVIDER: z.enum(['console']).default('console'),
  PAYMENT_PROVIDER: z.enum(['mock']).default('mock'),
  PUSH_PROVIDER: z.enum(['console', 'expo']).default('console'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  JOBS_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  adminPhones: parsed.data.ADMIN_PHONES.split(',')
    .map((p) => p.trim())
    .filter(Boolean),
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((o) => o.trim()),
  isProd: parsed.data.NODE_ENV === 'production',
};

// Business constants from the SRS (section 3.4).
export const rules = {
  reservationHoldMinutes: 10, // FR-B04
  buyerCancelHoursBefore: 2, // FR-B07
  reminderMinutesBefore: 30, // FR-B08
  complaintWindowHours: 24, // FR-B10
  minPriceKgs: 100, // FR-R01
  minValueMultiplier: 2, // FR-R01
  minWindowMinutes: 30, // FR-R02
  maxWindowMinutes: 180, // FR-R02
  issueGraceMinutes: 15, // staff may issue slightly before/after the window
  maxBoxesPerOrder: 3,
  maxPendingOrders: 2,
  autoPauseRating: 3.5, // FR-A04
  autoPauseMinReviews: 10, // FR-A04
  otpTtlMinutes: 5,
  otpMaxAttempts: 5,
  otpMaxPerHour: 5,
  accessTokenTtl: '30m',
  refreshTokenDays: 30,
  // Too Good To Go estimates ~2.7 kg CO2e avoided per saved meal.
  co2PerBoxKg: 2.7,
};
