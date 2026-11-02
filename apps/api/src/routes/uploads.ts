import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../lib/auth.js';
import { AppError } from '../lib/errors.js';
import { fileStorage } from '../providers/storage.js';

export { UPLOAD_DIR } from '../providers/storage.js';

const TYPES: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const MAX_BYTES = 5 * 1024 * 1024;

/** Box photos and complaint photos: Cloudflare R2 when configured, else the local disk. */
export async function uploadRoutes(app: FastifyInstance) {
  app.post('/uploads', { preHandler: requireAuth() }, async (request) => {
    const file = await request.file({ limits: { fileSize: MAX_BYTES } });
    if (!file) throw new AppError('file_required');
    const ext = TYPES[file.mimetype];
    if (!ext) throw new AppError('unsupported_file_type');
    const body = await file.toBuffer().catch(() => null);
    if (!body || file.file.truncated) throw new AppError('file_too_large', 413);
    const name = `${randomBytes(12).toString('hex')}${ext}`;
    return { url: await fileStorage.put(name, body, file.mimetype) };
  });
}
