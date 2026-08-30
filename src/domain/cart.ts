import type { Promo } from './promo';

/**
 * The cart is stored as an append-only event log and *derived* on read.
 * It makes the rules (merging, clamping, removal) live in one pure reducer that
 * is trivial to test, and it gives us an audit trail for free.
 */
export type CartEvent =
  | { type: 'item_added'; productId: string; qty: number }
  | { type: 'qty_changed'; productId: string; qty: number }
  | { type: 'item_removed'; productId: string }
  | { type: 'promo_applied'; promo: Promo }
  | { type: 'promo_removed' }
  | { type: 'cart_cleared' };

export type CartLine = { productId: string; qty: number };

export type CartState = {
  lines: readonly CartLine[];
  promo?: Promo;
};

export const MAX_QTY_PER_LINE = 20;

export const EMPTY_CART: CartState = { lines: [] };

function clampQty(qty: number): number {
  if (!Number.isFinite(qty)) return 0;
  return Math.max(0, Math.min(MAX_QTY_PER_LINE, Math.trunc(qty)));
}

function upsert(lines: readonly CartLine[], productId: string, qty: number): CartLine[] {
  const next = clampQty(qty);
  if (next === 0) return lines.filter((l) => l.productId !== productId);
  const exists = lines.some((l) => l.productId === productId);
  // Keep insertion order stable so the cart doesn't reshuffle as you edit it.
  if (exists) return lines.map((l) => (l.productId === productId ? { ...l, qty: next } : l));
  return [...lines, { productId, qty: next }];
}

export function applyCartEvent(state: CartState, event: CartEvent): CartState {
  switch (event.type) {
    case 'item_added': {
      const current = state.lines.find((l) => l.productId === event.productId)?.qty ?? 0;
      return { ...state, lines: upsert(state.lines, event.productId, current + event.qty) };
    }
    case 'qty_changed':
      return { ...state, lines: upsert(state.lines, event.productId, event.qty) };
    case 'item_removed':
      return { ...state, lines: state.lines.filter((l) => l.productId !== event.productId) };
    case 'promo_applied':
      return { ...state, promo: event.promo };
    case 'promo_removed':
      return { lines: state.lines };
    case 'cart_cleared':
      return EMPTY_CART;
  }
}

export function reduceCart(events: readonly CartEvent[]): CartState {
  return events.reduce(applyCartEvent, EMPTY_CART);
}

export function cartItemCount(state: CartState): number {
  return state.lines.reduce((sum, line) => sum + line.qty, 0);
}
