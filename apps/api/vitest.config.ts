import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: './test/global-setup.ts',
    fileParallelism: false,
    testTimeout: 20_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://hh:hh@localhost:5432/happyhours_test',
      JWT_SECRET: 'test-secret-access',
      PAYMENT_WEBHOOK_SECRET: 'test-secret-webhook',
      ADMIN_PHONES: '+996700000001',
      JOBS_ENABLED: 'false',
      PUBLIC_URL: 'http://localhost:4000',
    },
  },
});
