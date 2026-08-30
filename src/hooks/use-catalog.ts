import { useQuery } from '@tanstack/react-query';

import { useApi } from '../api/provider';
import type { Product } from '../domain/catalog';

export const catalogQueryKey = ['catalog'] as const;

export function useCatalog() {
  const api = useApi();
  return useQuery<Product[]>({
    queryKey: catalogQueryKey,
    queryFn: ({ signal }) => api.listProducts(signal),
    staleTime: 60_000,
  });
}
