import { mkdirSync } from 'node:fs';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { config } from './config.js';
import { prisma } from './db.js';
import { AppError, errorHandler } from './lib/errors.js';
import { adminRoutes } from './routes/admin/index.js';
import { authRoutes } from './routes/auth.js';
import { meRoutes } from './routes/me.js';
import { offerRoutes } from './routes/offers.js';
import { orderRoutes } from './routes/orders.js';
import { partnerRoutes } from './routes/partner/index.js';
import { paymentRoutes } from './routes/payments.js';
import { UPLOAD_DIR, uploadRoutes } from './routes/uploads.js';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string;
  }
}

export async function buildApp() {
  const app = Fastify({
    logger: config.NODE_ENV === 'test' ? false : { level: 'info' },
    // trust X-Forwarded-For only for the configured number of proxy hops (0 = none)
    trustProxy: (_address: string, hop: number) => hop < config.TRUST_PROXY,
  });

  // Keep the raw JSON body: payment webhooks are signed over the exact bytes.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    request.rawBody = body as string;
    if (!body) return done(null, undefined);
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      (err as Error & { statusCode?: number }).statusCode = 400;
      done(err as Error, undefined);
    }
  });
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_request, body, done) => {
    done(null, Object.fromEntries(new URLSearchParams(body as string)));
  });

  await app.register(cors, { origin: config.isProd ? config.corsOrigins : true, credentials: true });
  // Per-IP limits. Mobile carriers put many people behind one IP, so they are generous;
  // the per-phone OTP limits in routes/auth.ts are the main protection. Tests call the app
  // hundreds of times from one address, so the limits are off there.
  if (config.NODE_ENV !== 'test') {
    await app.register(rateLimit, {
      max: 600,
      timeWindow: '1 minute',
      errorResponseBuilder: () => new AppError('too_many_requests', 429),
    });
  }
  await app.register(multipart);
  mkdirSync(UPLOAD_DIR, { recursive: true });
  await app.register(fastifyStatic, { root: UPLOAD_DIR, prefix: '/uploads/', decorateReply: false });

  app.setErrorHandler(errorHandler);

  app.get('/health', async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  });

  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(offerRoutes);
  await app.register(orderRoutes);
  await app.register(paymentRoutes);
  await app.register(uploadRoutes);
  await app.register(partnerRoutes);
  await app.register(adminRoutes);

  return app;
}
