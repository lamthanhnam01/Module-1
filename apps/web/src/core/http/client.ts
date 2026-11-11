import type { ApiErrorPayload, ApiSuccess } from '@toantrung/contracts';

export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public requestId?: string,
  ) {
    super(message);
  }
}

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const GET_CACHE_FRESH_TTL_MS = 15_000;
const GET_CACHE_STALE_TTL_MS = 60_000;

const apiGetCache = new Map<string, CacheEntry>();
const inflightGetRequests = new Map<string, Promise<unknown>>();

export function peekApiCache<T>(path: string): T | null {
  const entry = apiGetCache.get(path);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > GET_CACHE_STALE_TTL_MS) {
    apiGetCache.delete(path);
    return null;
  }
  return entry.data as T;
}

export function invalidateApiCache(pathPrefix?: string): void {
  if (!pathPrefix) {
    apiGetCache.clear();
    inflightGetRequests.clear();
    return;
  }
  for (const key of apiGetCache.keys()) {
    if (key.startsWith(pathPrefix)) {
      apiGetCache.delete(key);
    }
  }
}

async function performNetworkFetch<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    csrfToken?: string;
    isFormData?: boolean;
    signal?: AbortSignal;
  },
): Promise<T> {
  const method = options.method || 'GET';
  const headers: Record<string, string> = {};

  if (!options.isFormData && options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.csrfToken && method !== 'GET') {
    headers['x-csrf-token'] = options.csrfToken;
  }

  headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
  headers['Pragma'] = 'no-cache';

  const res = await fetch(path, {
    method,
    headers,
    cache: 'no-store',
    credentials: 'include',
    signal: options.signal,
    body: options.isFormData
      ? (options.body as FormData)
      : options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
  });

  const payload = (await res.json().catch(() => null)) as
    | ApiSuccess<T>
    | ApiErrorPayload
    | null;

  if (!res.ok || !payload || 'error' in payload) {
    const errObj = payload && 'error' in payload ? payload.error : null;
    throw new ApiClientError(
      errObj?.code || 'HTTP_ERROR',
      errObj?.message || `Yêu cầu thất bại (Mã ${res.status}).`,
      res.status,
      errObj?.requestId,
    );
  }

  return payload.data;
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    csrfToken?: string;
    isFormData?: boolean;
    signal?: AbortSignal;
    skipCache?: boolean;
  } = {},
): Promise<T> {
  const method = options.method || 'GET';

  // Any mutation (POST, PATCH, DELETE) immediately invalidates cached GET responses
  // so subsequent reload calls always get 100% fresh state from the server.
  if (method !== 'GET') {
    invalidateApiCache();
    const result = await performNetworkFetch<T>(path, options);
    invalidateApiCache();
    return result;
  }

  const now = Date.now();
  if (!options.skipCache) {
    const cached = apiGetCache.get(path);
    if (cached) {
      const age = now - cached.timestamp;
      if (age <= GET_CACHE_FRESH_TTL_MS) {
        return cached.data as T;
      }
      if (age <= GET_CACHE_STALE_TTL_MS) {
        // Stale-while-revalidate: return cached data immediately and refresh silently
        if (!inflightGetRequests.has(path)) {
          const bgPromise = performNetworkFetch<T>(path, options)
            .then((freshData) => {
              apiGetCache.set(path, { data: freshData, timestamp: Date.now() });
              return freshData;
            })
            .catch(() => cached.data as T)
            .finally(() => {
              inflightGetRequests.delete(path);
            });
          inflightGetRequests.set(path, bgPromise);
        }
        return cached.data as T;
      }
    }
  }

  const existingInflight = inflightGetRequests.get(path);
  if (existingInflight && !options.signal) {
    return existingInflight as Promise<T>;
  }

  const requestPromise = performNetworkFetch<T>(path, options)
    .then((data) => {
      apiGetCache.set(path, { data, timestamp: Date.now() });
      return data;
    })
    .finally(() => {
      inflightGetRequests.delete(path);
    });

  if (!options.signal) {
    inflightGetRequests.set(path, requestPromise);
  }

  return requestPromise;
}
