// RNTL ships its jest matchers (toBeDisabled, toHaveTextContent, …) by default.
import { resetCartStore } from '../state/cart-store';
import { resetOrderStore } from '../state/order-store';

import { clearQueryClients } from './render';

/**
 * expo-router is replaced wholesale in unit tests: we assert on *intent to
 * navigate*, not on a real navigator. `mockRouter` is exported through
 * `src/test/router.ts` so tests can read the calls.
 */
export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
  dismissAll: jest.fn(),
  setParams: jest.fn(),
};

export const mockSearchParams: { current: Record<string, string> } = { current: {} };

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockSearchParams.current,
  useSegments: () => [],
  Link: 'Link',
  Stack: { Screen: 'Stack.Screen' },
}));

beforeEach(() => {
  Object.values(mockRouter).forEach((fn) => fn.mockClear());
  mockSearchParams.current = {};
  // Zustand stores are module singletons; without this, cart contents leak
  // between tests and you get order-dependent failures.
  resetCartStore();
  resetOrderStore();
});

afterEach(() => {
  clearQueryClients();
});
