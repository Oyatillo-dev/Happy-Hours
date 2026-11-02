import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config, rules } from '../config.js';
import { prisma } from '../db.js';
import { signAccessToken } from '../lib/auth.js';
import { normalizePhone, otpCode, refreshToken, sha256 } from '../lib/codes.js';
import { AppError } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { smsProvider } from '../providers/sms.js';
import { userDto } from './me.js';

const phoneSchema = z.string().transform((v, ctx) => {
  const phone = normalizePhone(v);
  if (!phone) {
    ctx.addIssue({ code: 'custom', message: 'invalid_phone' });
    return z.NEVER;
  }
  return phone;
});

async function issueTokens(userId: string) {
  const token = refreshToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + rules.refreshTokenDays * 86_400_000),
    },
  });
  return { accessToken: signAccessToken(userId), refreshToken: token };
}

export async function authRoutes(app: FastifyInstance) {
  // FR-B01: login by phone + SMS code. Each SMS costs money, so one IP may not
  // request codes for many different numbers.
  app.post('/auth/otp/request', { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (request) => {
    const { phone } = parse(z.object({ phone: phoneSchema }), request.body);
    const [lastHour, lastDay] = await Promise.all([
      prisma.otpCode.count({ where: { phone, createdAt: { gt: new Date(Date.now() - 3_600_000) } } }),
      prisma.otpCode.count({ where: { phone, createdAt: { gt: new Date(Date.now() - 86_400_000) } } }),
    ]);
    if (lastHour >= rules.otpMaxPerHour || lastDay >= rules.otpMaxPerDay) {
      throw new AppError('too_many_requests', 429);
    }

    const code = otpCode();
    await prisma.otpCode.create({
      data: { phone, codeHash: sha256(`${phone}:${code}`), expiresAt: new Date(Date.now() + rules.otpTtlMinutes * 60_000) },
    });
    await smsProvider.send(phone, `Happy Hours: ваш код ${code}`);
    // Without a real SMS gateway the code is returned so the apps can be tried out
    // (in production only on a test server that sets SHOW_OTP_CODES).
    const exposeCode = config.SMS_PROVIDER === 'console' && (!config.isProd || config.SHOW_OTP_CODES);
    return { ok: true, phone, ...(exposeCode ? { devCode: code } : {}) };
  });

  app.post('/auth/otp/verify', { config: { rateLimit: { max: 60, timeWindow: '10 minutes' } } }, async (request) => {
    const body = parse(
      z.object({
        phone: phoneSchema,
        code: z.string().regex(/^\d{6}$/),
        name: z.string().trim().min(1).max(80).optional(),
        language: z.enum(['ru', 'ky']).optional(),
      }),
      request.body,
    );
    const otp = await prisma.otpCode.findFirst({
      where: { phone: body.phone, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.attempts >= rules.otpMaxAttempts) throw new AppError('code_expired', 400);
    if (otp.codeHash !== sha256(`${body.phone}:${body.code}`)) {
      await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new AppError('code_invalid', 400);
    }
    await prisma.otpCode.update({ where: { id: otp.id }, data: { usedAt: new Date() } });

    const isAdmin = config.adminPhones.includes(body.phone);
    const existing = await prisma.user.findUnique({ where: { phone: body.phone } });
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            ...(body.name && !existing.name ? { name: body.name } : {}),
            ...(body.language ? { language: body.language } : {}),
            ...(isAdmin && existing.role !== 'ADMIN' ? { role: 'ADMIN' } : {}),
          },
          include: { partner: true },
        })
      : await prisma.user.create({
          data: {
            phone: body.phone,
            name: body.name,
            language: body.language ?? 'ru',
            role: isAdmin ? 'ADMIN' : 'BUYER',
          },
          include: { partner: true },
        });
    return { ...(await issueTokens(user.id)), user: userDto(user), isNew: !existing };
  });

  app.post('/auth/refresh', async (request) => {
    const { refreshToken: token } = parse(z.object({ refreshToken: z.string().min(10) }), request.body);
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.user.deletedAt) {
      throw new AppError('invalid_refresh_token', 401);
    }
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return issueTokens(stored.userId);
  });

  app.post('/auth/logout', async (request) => {
    const { refreshToken: token } = parse(z.object({ refreshToken: z.string() }), request.body);
    await prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  });
}
