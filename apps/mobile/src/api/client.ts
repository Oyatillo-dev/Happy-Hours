import { secureStorage } from '@/lib/secureStorage';

const DEFAULT_API_URL = 'http://localhost:4000';

/** Base URL of apps/api. On a real phone this must be the computer's LAN IP (see README). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');

/**
 * The API builds absolute URLs (payUrl, uploaded photos) from its PUBLIC_URL, which defaults to
 * http://localhost:4000. A phone cannot reach the computer's localhost, so such URLs are rewritten
 * to the API origin the app is configured with. Relative URLs are resolved against it too.
 */
export function resolveApiUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('/')) return `${API_URL}${url}`;
  const m = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.exec(url);
  if (m && !/localhost|127\.0\.0\.1/i.test(API_URL)) return API_URL + url.slice(m[0].length);
  return url;
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message?: string,
    public readonly details?: unknown,
  ) {
    super(message ?? code);
  }
}

export const isNetworkError = (e: unknown) => e instanceof ApiError && e.code === 'network_error';

// ---------- session ----------

const ACCESS_KEY = 'hh.accessToken';
const REFRESH_KEY = 'hh.refreshToken';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

let tokens: Tokens | null = null;
let onSessionExpired: (() => void) | null = null;
let refreshing: Promise<boolean> | null = null;

export const session = {
  async load(): Promise<boolean> {
    const [accessToken, refreshToken] = await Promise.all([
      secureStorage.get(ACCESS_KEY),
      secureStorage.get(REFRESH_KEY),
    ]);
    tokens = accessToken && refreshToken ? { accessToken, refreshToken } : null;
    return !!tokens;
  },
  async save(next: Tokens) {
    tokens = next;
    await Promise.all([secureStorage.set(ACCESS_KEY, next.accessToken), secureStorage.set(REFRESH_KEY, next.refreshToken)]);
  },
  async clear() {
    tokens = null;
    await Promise.all([secureStorage.remove(ACCESS_KEY), secureStorage.remove(REFRESH_KEY)]);
  },
  get refreshToken() {
    return tokens?.refreshToken ?? null;
  },
  get isAuthenticated() {
    return !!tokens;
  },
  /** Called when the refresh token is rejected: the auth context logs the user out. */
  onExpired(cb: (() => void) | null) {
    onSessionExpired = cb;
  },
};

/** Rotates both tokens. Only one refresh runs at a time; concurrent 401s wait for it. */
async function refreshTokens(): Promise<boolean> {
  if (!tokens) return false;
  if (!refreshing) {
    const current = tokens.refreshToken;
    refreshing = (async () => {
      try {
        const next = await rawRequest<Tokens>('POST', '/auth/refresh', { refreshToken: current }, null);
        await session.save(next);
        return true;
      } catch (e) {
        // Offline: keep the session, the next request will try again.
        if (isNetworkError(e)) throw e;
        await session.clear();
        onSessionExpired?.();
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

// ---------- requests ----------

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Query = Record<string, string | number | boolean | undefined | null>;

function buildQuery(query?: Query) {
  if (!query) return '';
  const parts = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

async function rawRequest<T>(
  method: Method,
  path: string,
  body: unknown,
  accessToken: string | null,
  query?: Query,
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}${buildQuery(query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('network_error', 0);
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(err?.code ?? (res.status >= 500 ? 'internal_error' : 'bad_request'), res.status, err?.message, err?.details);
  }
  return data as T;
}

export interface RequestOptions {
  body?: unknown;
  query?: Query;
  /** Send the access token if there is one (default true). */
  auth?: boolean;
  /** Endpoint also works anonymously: if the session is gone, retry without a token. */
  optionalAuth?: boolean;
}

/**
 * JSON request to the API. On 401 `invalid_token` it refreshes the tokens once and retries;
 * if the refresh fails the session is cleared and the auth context logs out.
 */
export async function api<T>(method: Method, path: string, opts: RequestOptions = {}): Promise<T> {
  const useAuth = opts.auth !== false;
  try {
    return await rawRequest<T>(method, path, opts.body, useAuth ? (tokens?.accessToken ?? null) : null, opts.query);
  } catch (e) {
    if (useAuth && tokens && e instanceof ApiError && e.status === 401 && e.code === 'invalid_token') {
      if (await refreshTokens()) {
        return rawRequest<T>(method, path, opts.body, tokens?.accessToken ?? null, opts.query);
      }
      if (opts.optionalAuth) return rawRequest<T>(method, path, opts.body, null, opts.query);
      throw new ApiError('session_expired', 401);
    }
    throw e;
  }
}
