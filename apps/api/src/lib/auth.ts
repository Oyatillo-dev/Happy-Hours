import type { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { config, rules } from '../config.js';
import { prisma } from '../db.js';
import { AppError } from './errors.js';

export interface AuthUser {
  id: string;
  role: Role;
  partnerId: string | null;
  locationId: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export function signAccessToken(userId: string) {
  return jwt.sign({ sub: userId }, config.JWT_SECRET, {
    expiresIn: rules.accessTokenTtl as jwt.SignOptions['expiresIn'],
  });
}

async function resolveUser(request: FastifyRequest): Promise<AuthUser | undefined> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  let sub: string;
  try {
    sub = (jwt.verify(header.slice(7), config.JWT_SECRET) as jwt.JwtPayload).sub as string;
  } catch {
    throw new AppError('invalid_token', 401);
  }
  const user = await prisma.user.findUnique({
    where: { id: sub },
    select: { id: true, role: true, partnerId: true, locationId: true, deletedAt: true },
  });
  if (!user || user.deletedAt) throw new AppError('invalid_token', 401);
  return { id: user.id, role: user.role, partnerId: user.partnerId, locationId: user.locationId };
}

/** Attaches request.user when a valid token is present; never rejects anonymous calls. */
export async function optionalAuth(request: FastifyRequest) {
  request.user = await resolveUser(request);
}

export function requireAuth(...roles: Role[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    request.user = await resolveUser(request);
    if (!request.user) throw new AppError('unauthorized', 401);
    if (roles.length && !roles.includes(request.user.role)) throw new AppError('forbidden', 403);
  };
}

export const requirePartner = requireAuth('PARTNER_OWNER', 'PARTNER_STAFF');
export const requireOwner = requireAuth('PARTNER_OWNER');
export const requireStaffAdmin = requireAuth('SUPPORT', 'ADMIN');
export const requireAdmin = requireAuth('ADMIN');

export function currentUser(request: FastifyRequest): AuthUser {
  if (!request.user) throw new AppError('unauthorized', 401);
  return request.user;
}

export function partnerIdOf(request: FastifyRequest): string {
  const user = currentUser(request);
  if (!user.partnerId) throw new AppError('partner_required', 403);
  return user.partnerId;
}
