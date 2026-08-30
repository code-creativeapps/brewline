import { applyCartEvent, EMPTY_CART } from '../domain/cart';

import { useCartStore } from './cart-store';

/**
 * The store is a thin shell over the pure reducer — these tests only cover the
 * shell: that every action appends to the log and that the derived cart stays
 * in step with it.
 */
describe('useCartStore', () => {
  it('appends an event per action and never rewrites history', () => {
    const { addItem, setQty, applyPromo } = useCartStore.getState();

    addItem('a', 2);
    setQty('a', 5);
    applyPromo({ code: 'BREW10', kind: 'percent', percentOff: 10 });

    expect(useCartStore.getState().events).toEqual([
      { type: 'item_added', productId: 'a', qty: 2 },
      { type: 'qty_changed', productId: 'a', qty: 5 },
      { type: 'promo_applied', promo: { code: 'BREW10', kind: 'percent', percentOff: 10 } },
    ]);
  });

  it('keeps the derived cart identical to a replay of the log', () => {
    const { addItem, setQty, removeItem } = useCartStore.getState();

    addItem('a', 1);
    addItem('b', 3);
    setQty('a', 4);
    removeItem('b');

    const { events, cart } = useCartStore.getState();
    const replayed = events.reduce(applyCartEvent, EMPTY_CART);

    expect(cart).toEqual(replayed);
  });

  it('clears back to an empty cart', () => {
    const { addItem, clear } = useCartStore.getState();
    addItem('a', 1);

    clear();

    expect(useCartStore.getState().cart.lines).toEqual([]);
  });
});
