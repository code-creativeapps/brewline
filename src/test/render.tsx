import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { ApiProvider } from '../api/provider';
import type { ApiClient, Order, OrderDraft } from '../api/types';
import type { Product } from '../domain/catalog';
import type { Promo } from '../domain/promo';

/**
 * Every screen test mounts through here, so a screen is always tested inside
 * the providers it actually runs in. Only the network boundary is faked.
 */
export async function renderScreen(
  ui: ReactElement,
  { api, ...options }: RenderOptions & { api: ApiClient },
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      // No retries: a rejected query should surface as an error immediately
      // rather than making the test wait out a backoff.
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  activeClients.add(queryClient);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ApiProvider client={api}>{children}</ApiProvider>
      </QueryClientProvider>
    );
  }

  // RNTL 14's `render` is async: React 19 flushes effects inside `act`.
  return { ...(await render(ui, { wrapper: Wrapper, ...options })), queryClient };
}

const activeClients = new Set<QueryClient>();

/**
 * Called from the global afterEach. Without it, query clients keep their cache
 * timers alive after a test finishes and Jest reports leaked handles.
 */
export function clearQueryClients() {
  activeClients.forEach((client) => {
    client.cancelQueries();
    client.unmount();
    client.clear();
  });
  activeClients.clear();
}

type StubOverrides = Partial<ApiClient>;

/** A jest-mock-backed ApiClient. Override just the call the test cares about. */
export function stubApi(overrides: StubOverrides = {}): jest.Mocked<ApiClient> {
  const products: Product[] = [];
  const promo: Promo = { code: 'BREW10', kind: 'percent', percentOff: 10 };
  const order: Order = {
    id: 'ord_1',
    reference: 'BRW-1001',
    totalCents: 0,
    email: 'test@example.com',
    etaDays: 3,
  };

  return {
    listProducts: jest.fn(async () => products),
    validatePromo: jest.fn(async () => promo),
    createOrder: jest.fn(async (draft: OrderDraft) => ({ ...order, totalCents: draft.totalCents })),
    ...overrides,
  } as jest.Mocked<ApiClient>;
}

/** A promise you resolve by hand — for asserting on loading states. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
