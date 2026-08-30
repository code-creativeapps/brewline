import { createContext, useContext, type ReactNode } from 'react';

import { createFakeApiClient } from './fake-client';
import { createHttpApiClient } from './http-client';
import type { ApiClient } from './types';

const ApiContext = createContext<ApiClient | null>(null);

/**
 * `EXPO_PUBLIC_API_MODE=fake` (set by the `e2e` build profile) swaps the whole
 * network layer for an in-memory one. Nothing else in the app knows or cares.
 */
export function createDefaultApiClient(): ApiClient {
  if (process.env.EXPO_PUBLIC_API_MODE === 'fake') {
    return createFakeApiClient(Number(process.env.EXPO_PUBLIC_FAKE_LATENCY_MS ?? 150));
  }
  return createHttpApiClient({
    baseUrl: process.env.EXPO_PUBLIC_API_URL ?? 'https://api.brewline.example/v1',
  });
}

export function ApiProvider({ client, children }: { client: ApiClient; children: ReactNode }) {
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) throw new Error('useApi must be used inside <ApiProvider>');
  return client;
}
