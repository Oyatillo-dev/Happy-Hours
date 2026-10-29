import { randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { requireAuth } from '../lib/auth.js';
import { AppError } from '../lib/errors.js';

export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
const TYPES: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

/** Box photos and complaint photos. Local disk for the MVP; swap for S3-compatible storage later. */
export async function uploadRoutes(app: FastifyInstance) {
  app.post('/uploads', { preHandler: requireAuth() }, async (request) => {
    const file = await request.file({ limits: { fileSize: 5 * 1024 * 1024 } });
    if (!file) throw new AppError('file_required');
    const ext = TYPES[file.mimetype];
    if (!ext) throw new AppError('unsupported_file_type');
    const name = `${randomBytes(12).toString('hex')}${ext}`;
    await pipeline(file.file, createWriteStream(path.join(UPLOAD_DIR, name)));
    if (file.file.truncated) throw new AppError('file_too_large', 413);
    return { url: `${config.PUBLIC_URL}/uploads/${name}` };
  });
}
