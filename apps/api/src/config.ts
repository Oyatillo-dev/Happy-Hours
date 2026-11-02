import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  // Render sets RENDER_EXTERNAL_URL to the service's public address.
  PUBLIC_URL: z
    .string()
    .url()
    .default(process.env.RENDER_EXTERNAL_URL ?? 'http://localhost:4000'),
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
  // How many reverse proxies (nginx, a load balancer) sit in front of the API. The client IP,
  // and with it the rate limits, is taken from X-Forwarded-For only that many hops deep;
  // trusting it blindly would let anyone pick their own IP and skip the limits.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  // The mock acquirer marks orders paid without money; production refuses it unless this is set.
  ALLOW_MOCK_PAYMENTS: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  // Test servers without an SMS gateway: return the login code in the API response (as in
  // development) so testers can sign in. Anyone could then sign in as anyone: never on a live server.
  SHOW_OTP_CODES: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  // Cloudflare R2 for uploaded photos; without it they are kept on the API's own disk.
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_URL: z.string().url().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

/** Refuses to start production with secrets anyone can read in the repo, or with free "payments". */
function productionProblems(env: z.infer<typeof schema>) {
  const problems: string[] = [];
  const weak = (s: string) => s.length < 32 || /change-me/i.test(s);
  if (weak(env.JWT_SECRET)) problems.push('JWT_SECRET must be a random string of 32+ characters');
  if (weak(env.PAYMENT_WEBHOOK_SECRET)) problems.push('PAYMENT_WEBHOOK_SECRET must be a random string of 32+ characters');
  if (env.PAYMENT_PROVIDER === 'mock' && !env.ALLOW_MOCK_PAYMENTS) {
    problems.push('PAYMENT_PROVIDER=mock lets anyone pay without money; connect a bank or set ALLOW_MOCK_PAYMENTS=true for a test server');
  }
  if (env.SMS_PROVIDER === 'console' && !env.SHOW_OTP_CODES) {
    problems.push('SMS_PROVIDER=console sends no SMS, so nobody could sign in; connect an SMS gateway or set SHOW_OTP_CODES=true for a test server');
  }
  if (!env.ADMIN_PHONES.trim()) problems.push('ADMIN_PHONES is empty');
  return problems;
}

if (parsed.data.NODE_ENV === 'production') {
  const problems = productionProblems(parsed.data);
  if (problems.length) {
    console.error(`Refusing to start in production:\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  if (parsed.data.ALLOW_MOCK_PAYMENTS || parsed.data.SHOW_OTP_CODES) {
    console.warn('TEST SERVER: mock payments and/or login codes in API responses are enabled. Do not use for real customers.');
  }
}

export const config = {
  ...parsed.data,
  adminPhones: parsed.data.ADMIN_PHONES.split(',')
    .map((p) => p.trim())
    .filter(Boolean),
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((o) => o.trim()),
  isProd: parsed.data.NODE_ENV === 'production',
  r2: r2Config(parsed.data),
};

/** All five R2 settings, or none (local disk). A partial set is a mistake worth stopping for. */
function r2Config(env: z.infer<typeof schema>) {
  const values = {
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET,
    publicUrl: env.R2_PUBLIC_URL?.replace(/\/+$/, ''),
  };
  const set = Object.values(values).filter(Boolean).length;
  if (set === 0) return null;
  if (set < 5) {
    console.error('Invalid environment: set all of R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL or none');
    process.exit(1);
  }
  return values as { [K in keyof typeof values]: string };
}

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
  otpMaxPerDay: 10,
  accessTokenTtl: '30m',
  refreshTokenDays: 30,
  // Too Good To Go estimates ~2.7 kg CO2e avoided per saved meal.
  co2PerBoxKg: 2.7,
};
