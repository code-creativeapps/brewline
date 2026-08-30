import {
  applyCartEvent,
  cartItemCount,
  EMPTY_CART,
  MAX_QTY_PER_LINE,
  reduceCart,
  type CartEvent,
} from './cart';
import type { Promo } from './promo';

const BREW10: Promo = { code: 'BREW10', kind: 'percent', percentOff: 10 };

const log = (...events: CartEvent[]) => reduceCart(events);

describe('reduceCart', () => {
  it('starts empty', () => {
    expect(reduceCart([])).toEqual(EMPTY_CART);
  });

  it('merges repeat adds of the same product into one line', () => {
    const cart = log(
      { type: 'item_added', productId: 'a', qty: 2 },
      { type: 'item_added', productId: 'a', qty: 3 },
    );

    expect(cart.lines).toEqual([{ productId: 'a', qty: 5 }]);
  });

  it('keeps lines in the order they were first added, even after an edit', () => {
    const cart = log(
      { type: 'item_added', productId: 'a', qty: 1 },
      { type: 'item_added', productId: 'b', qty: 1 },
      { type: 'qty_changed', productId: 'a', qty: 4 },
    );

    expect(cart.lines.map((l) => l.productId)).toEqual(['a', 'b']);
  });

  it('drops the line when quantity is set to zero', () => {
    const cart = log(
      { type: 'item_added', productId: 'a', qty: 2 },
      { type: 'qty_changed', productId: 'a', qty: 0 },
    );

    expect(cart.lines).toEqual([]);
  });

  it('never lets a quantity go negative', () => {
    const cart = log(
      { type: 'item_added', productId: 'a', qty: 1 },
      { type: 'qty_changed', productId: 'a', qty: -5 },
    );

    expect(cart.lines).toEqual([]);
  });

  it(`clamps a line to ${MAX_QTY_PER_LINE}`, () => {
    const cart = log({ type: 'item_added', productId: 'a', qty: 999 });

    expect(cart.lines).toEqual([{ productId: 'a', qty: MAX_QTY_PER_LINE }]);
  });

  it('ignores removal of a product that is not in the cart', () => {
    const before = log({ type: 'item_added', productId: 'a', qty: 1 });
    const after = applyCartEvent(before, { type: 'item_removed', productId: 'ghost' });

    expect(after.lines).toEqual(before.lines);
  });

  it('replaces an applied promo rather than stacking codes', () => {
    const cart = log(
      { type: 'promo_applied', promo: BREW10 },
      { type: 'promo_applied', promo: { code: 'FIVEOFF', kind: 'fixed', amountCents: 500 } },
    );

    expect(cart.promo?.code).toBe('FIVEOFF');
  });

  it('clears the promo along with the items', () => {
    const cart = log(
      { type: 'item_added', productId: 'a', qty: 1 },
      { type: 'promo_applied', promo: BREW10 },
      { type: 'cart_cleared' },
    );

    expect(cart).toEqual(EMPTY_CART);
  });

  it('removing the promo leaves the items alone', () => {
    const cart = log(
      { type: 'item_added', productId: 'a', qty: 2 },
      { type: 'promo_applied', promo: BREW10 },
      { type: 'promo_removed' },
    );

    expect(cart.promo).toBeUndefined();
    expect(cart.lines).toEqual([{ productId: 'a', qty: 2 }]);
  });

  it('never mutates the state it is given', () => {
    const before = log({ type: 'item_added', productId: 'a', qty: 1 });
    const snapshot = JSON.parse(JSON.stringify(before));

    applyCartEvent(before, { type: 'qty_changed', productId: 'a', qty: 9 });

    expect(before).toEqual(snapshot);
  });

  it('is a pure function of the log — replaying gives the same cart', () => {
    const events: CartEvent[] = [
      { type: 'item_added', productId: 'a', qty: 2 },
      { type: 'item_added', productId: 'b', qty: 1 },
      { type: 'qty_changed', productId: 'a', qty: 5 },
      { type: 'promo_applied', promo: BREW10 },
    ];

    expect(reduceCart(events)).toEqual(reduceCart(events));
  });
});

describe('cartItemCount', () => {
  it('sums quantities across lines', () => {
    const cart = log(
      { type: 'item_added', productId: 'a', qty: 2 },
      { type: 'item_added', productId: 'b', qty: 3 },
    );

    expect(cartItemCount(cart)).toBe(5);
  });
});
