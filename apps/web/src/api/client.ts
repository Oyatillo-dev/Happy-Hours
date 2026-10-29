import type { Tokens } from './types';

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:4000';

const STORAGE_KEY = 'hh.tokens';

/** Error with the API's stable machine code (`{ error: { code, message, details } }`). */
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

let tokens: Tokens | null = readTokens();
const listeners = new Set<(t: Tokens | null) => void>();

function readTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

export function getTokens() {
  return tokens;
}

export function setTokens(next: Tokens | null) {
  tokens = next;
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable: keep tokens in memory only */
  }
  listeners.forEach((l) => l(next));
}

export function onTokensChange(listener: (t: Tokens | null) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let refreshing: Promise<boolean> | null = null;

/** Rotates both tokens once; concurrent 401s share the same refresh call. */
function refreshTokens(): Promise<boolean> {
  if (!refreshing) {
    const current = tokens;
    refreshing = (async () => {
      if (!current) return false;
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        });
        if (!res.ok) return false;
        setTokens((await res.json()) as Tokens);
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

export type Query = Record<string, string | number | boolean | undefined | null>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Query;
  /** Skip auth header and refresh logic (login endpoints). */
  anonymous?: boolean;
}

function buildUrl(path: string, query?: Query) {
  const url = new URL(path, API_URL);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function send(path: string, opts: RequestOptions, retried = false): Promise<Response> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (opts.body instanceof FormData) body = opts.body;
  else if (opts.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  if (!opts.anonymous && tokens) headers.authorization = `Bearer ${tokens.accessToken}`;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), { method: opts.method ?? 'GET', headers, body });
  } catch {
    throw new ApiError('network_error', 0);
  }
  if (res.ok) return res;

  const payload = (await res.json().catch(() => null)) as {
    error?: { code?: string; message?: string; details?: unknown };
  } | null;
  const err = new ApiError(
    payload?.error?.code ?? `http_${res.status}`,
    res.status,
    payload?.error?.message,
    payload?.error?.details,
  );
  if (res.status === 401 && !opts.anonymous) {
    if (err.code === 'invalid_token' && !retried && (await refreshTokens())) {
      return send(path, opts, true);
    }
    setTokens(null); // session is over
  }
  throw err;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await send(path, opts);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Downloads a file with the auth header (used for CSV export). */
export async function download(path: string, query: Query, filename: string) {
  const res = await send(path, { query });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function upload(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append('file', file);
  return api('/uploads', { method: 'POST', body: form });
}
