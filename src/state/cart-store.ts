import { create } from 'zustand';

import {
  applyCartEvent,
  cartItemCount,
  EMPTY_CART,
  type CartEvent,
  type CartState,
} from '../domain/cart';
import type { Promo } from '../domain/promo';

type CartStore = {
  /** The append-only log. Kept so the derived state is always reproducible. */
  events: CartEvent[];
  cart: CartState;
  dispatch: (event: CartEvent) => void;
  addItem: (productId: string, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  removeItem: (productId: string) => void;
  applyPromo: (promo: Promo) => void;
  removePromo: () => void;
  clear: () => void;
};

export const useCartStore = create<CartStore>((set, get) => ({
  events: [],
  cart: EMPTY_CART,

  dispatch: (event) =>
    set((state) => ({
      events: [...state.events, event],
      cart: applyCartEvent(state.cart, event),
    })),

  addItem: (productId, qty = 1) => get().dispatch({ type: 'item_added', productId, qty }),
  setQty: (productId, qty) => get().dispatch({ type: 'qty_changed', productId, qty }),
  removeItem: (productId) => get().dispatch({ type: 'item_removed', productId }),
  applyPromo: (promo) => get().dispatch({ type: 'promo_applied', promo }),
  removePromo: () => get().dispatch({ type: 'promo_removed' }),
  clear: () => get().dispatch({ type: 'cart_cleared' }),
}));

export function useCartItemCount(): number {
  return useCartStore((state) => cartItemCount(state.cart));
}

/** Used by tests (and the "start a new order" button) to get back to a clean slate. */
export function resetCartStore() {
  useCartStore.setState({ events: [], cart: EMPTY_CART });
}
