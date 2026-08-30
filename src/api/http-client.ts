import type { Product } from '../domain/catalog';
import type { Promo } from '../domain/promo';

import {
  CardDeclinedError,
  HttpError,
  NetworkError,
  PromoInvalidError,
  SessionExpiredError,
  TimeoutError,
} from './errors';
import type { ApiClient, Order, OrderDraft } from './types';

export type HttpClientOptions = {
  baseUrl: string;
  /** Injected so tests can supply MSW's fetch, or a stub, without globals. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 8000;

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
};

export function createHttpApiClient(options: HttpClientOptions): ApiClient {
  const { baseUrl, fetchImpl, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  // Resolved per call, not captured at construction: something may replace the
  // global `fetch` after the client is built (MSW in tests, a tracing shim in
  // production) and we want the current one.
  const doFetch: typeof fetch = (input, init) => (fetchImpl ?? globalThis.fetch)(input, init);

  async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    // Propagate an upstream cancellation (unmounted screen) into our controller.
    opts.signal?.addEventListener('abort', () => controller.abort(), { once: true });

    let response: Response;
    try {
      response = await doFetch(`${baseUrl}${path}`, {
        method: opts.method ?? 'GET',
        headers: opts.body ? { 'content-type': 'application/json' } : undefined,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted && !opts.signal?.aborted) throw new TimeoutError(timeoutMs);
      throw new NetworkError();
    } finally {
      clearTimeout(timer);
    }

    if (response.ok) {
      try {
        return (await response.json()) as T;
      } catch {
        throw new HttpError(response.status, 'Malformed response from server');
      }
    }

    const payload = await readErrorPayload(response);
    throw toDomainError(response.status, payload, path);
  }

  return {
    listProducts: (signal) => request<Product[]>('/products', { signal }),

    validatePromo: (code, signal) =>
      request<Promo>(`/promos/${encodeURIComponent(code)}`, { signal }),

    createOrder: (draft: OrderDraft, signal) =>
      request<Order>('/orders', { method: 'POST', body: draft, signal }),
  };
}

async function readErrorPayload(response: Response): Promise<{ code?: string; message?: string }> {
  try {
    return (await response.json()) as { code?: string; message?: string };
  } catch {
    return {};
  }
}

function toDomainError(status: number, payload: { code?: string; message?: string }, path: string) {
  if (status === 401) return new SessionExpiredError();
  if (status === 404 && path.startsWith('/promos/')) {
    return new PromoInvalidError(decodeURIComponent(path.replace('/promos/', '')));
  }
  if (status === 402) return new CardDeclinedError(payload.message ?? 'Your card was declined');
  return new HttpError(status, payload.message);
}
