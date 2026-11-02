import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

/** Where uploaded box and complaint photos go. */
export interface FileStorage {
  readonly name: string;
  /** Stores the file under `key` and returns its public URL. */
  put(key: string, body: Buffer, contentType: string): Promise<string>;
}

export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

/** Development: files on the API's own disk, served at /uploads/. */
class LocalStorage implements FileStorage {
  readonly name = 'local';

  constructor() {
    mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  async put(key: string, body: Buffer) {
    await writeFile(path.join(UPLOAD_DIR, key), body);
    return `${config.PUBLIC_URL}/uploads/${key}`;
  }
}

/** Cloudflare R2 (S3-compatible): files outlive deploys and are served by Cloudflare. */
class R2Storage implements FileStorage {
  readonly name = 'r2';
  private readonly client: S3Client;

  constructor(
    accountId: string,
    accessKeyId: string,
    secretAccessKey: string,
    private readonly bucket: string,
    private readonly publicUrl: string,
  ) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // names are random and never reused, so browsers may keep them for good
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return `${this.publicUrl}/${key}`;
  }
}

export const fileStorage: FileStorage = config.r2
  ? new R2Storage(config.r2.accountId, config.r2.accessKeyId, config.r2.secretAccessKey, config.r2.bucket, config.r2.publicUrl)
  : new LocalStorage();
