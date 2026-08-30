import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

import { ApiProvider, createDefaultApiClient } from '../src/api/provider';
import type { ApiClient } from '../src/api/types';
import { theme } from '../src/theme';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 1, refetchOnWindowFocus: false },
      mutations: { retry: 0 },
    },
  });
}

export default function RootLayout() {
  // Created once per app instance; tests mount screens with their own provider.
  const [queryClient] = useState(makeQueryClient);
  const [apiClient] = useState<ApiClient>(createDefaultApiClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider client={apiClient}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.colors.bg },
            headerShadowVisible: false,
            headerTintColor: theme.colors.text,
            contentStyle: { backgroundColor: theme.colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Brewline' }} />
          <Stack.Screen name="cart" options={{ title: 'Basket' }} />
          <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />
          <Stack.Screen name="order/[id]" options={{ title: 'Order', headerBackVisible: false }} />
          <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
        </Stack>
      </ApiProvider>
    </QueryClientProvider>
  );
}
