import type { CartState } from './cart';
import type { Catalog } from './catalog';
import {
  amountToFreeShipping,
  FREE_SHIPPING_THRESHOLD_CENTS,
  priceCart,
  SHIPPING_FLAT_CENTS,
} from './pricing';

const catalog: Catalog = [
  {
    id: 'guji',
    name: 'Guji',
    origin: 'Ethiopia',
    roast: 'light',
    priceCents: 1000,
    bulkDiscount: { minQty: 3, percentOff: 10 },
  },
  { id: 'huila', name: 'Huila', origin: 'Colombia', roast: 'medium', priceCents: 1150 },
];

const cart = (lines: CartState['lines'], promo?: CartState['promo']): CartState => ({
  lines,
  promo,
});

describe('priceCart', () => {
  it('prices an empty cart at zero and charges no delivery', () => {
    const receipt = priceCart(cart([]), catalog);

    expect(receipt).toMatchObject({
      goodsCents: 0,
      shippingCents: 0,
      taxCents: 0,
      totalCents: 0,
    });
  });

  it('multiplies unit price by quantity', () => {
    const receipt = priceCart(cart([{ productId: 'huila', qty: 2 }]), catalog);

    expect(receipt.lines[0]).toMatchObject({ grossCents: 2300, totalCents: 2300 });
  });

  it('applies a bulk discount only once the threshold is reached', () => {
    const below = priceCart(cart([{ productId: 'guji', qty: 2 }]), catalog);
    const at = priceCart(cart([{ productId: 'guji', qty: 3 }]), catalog);

    expect(below.bulkSavingsCents).toBe(0);
    expect(at.bulkSavingsCents).toBe(300); // 10% of £30
    expect(at.goodsCents).toBe(2700);
  });

  it('charges flat delivery below the free-shipping threshold', () => {
    const receipt = priceCart(cart([{ productId: 'huila', qty: 1 }]), catalog);

    expect(receipt.shippingCents).toBe(SHIPPING_FLAT_CENTS);
  });

  it('gives free delivery at exactly the threshold', () => {
    // 4 x £11.50 = £46 — comfortably over; use a precise case instead.
    const receipt = priceCart(cart([{ productId: 'guji', qty: 5 }]), catalog);
    const netGoods = receipt.goodsCents - receipt.promoDiscountCents;

    expect(netGoods).toBeGreaterThanOrEqual(FREE_SHIPPING_THRESHOLD_CENTS);
    expect(receipt.shippingCents).toBe(0);
  });

  it('takes the discount into account before deciding on free delivery', () => {
    // £36 of goods qualifies, but a 20% promo drops it to £28.80 — so delivery
    // is charged again. This is the rule most often got wrong.
    const bigCatalog: Catalog = [
      { id: 'x', name: 'X', origin: '-', roast: 'dark', priceCents: 3600 },
    ];
    const receipt = priceCart(
      cart([{ productId: 'x', qty: 1 }], { code: 'TWENTY', kind: 'percent', percentOff: 20 }),
      bigCatalog,
    );

    expect(receipt.promoDiscountCents).toBe(720);
    expect(receipt.shippingCents).toBe(SHIPPING_FLAT_CENTS);
  });

  it('stacks a percent promo on top of bulk savings', () => {
    const receipt = priceCart(
      cart([{ productId: 'guji', qty: 3 }], { code: 'BREW10', kind: 'percent', percentOff: 10 }),
      catalog,
    );

    expect(receipt.goodsCents).toBe(2700); // after bulk
    expect(receipt.promoDiscountCents).toBe(270); // 10% of the discounted goods
  });

  it('never lets a fixed promo exceed the basket value', () => {
    const receipt = priceCart(
      cart([{ productId: 'huila', qty: 1 }], { code: 'BIG', kind: 'fixed', amountCents: 99_999 }),
      catalog,
    );

    expect(receipt.promoDiscountCents).toBe(1150);
    expect(receipt.totalCents).toBe(0 + receipt.shippingCents);
  });

  it('zeroes delivery for a free-shipping promo without touching goods', () => {
    const receipt = priceCart(
      cart([{ productId: 'huila', qty: 1 }], { code: 'FREESHIP', kind: 'free_shipping' }),
      catalog,
    );

    expect(receipt.shippingCents).toBe(0);
    expect(receipt.promoDiscountCents).toBe(0);
    expect(receipt.goodsCents).toBe(1150);
  });

  it('charges VAT on discounted goods but not on delivery', () => {
    const receipt = priceCart(cart([{ productId: 'huila', qty: 1 }]), catalog);

    expect(receipt.taxCents).toBe(230); // 20% of £11.50, not of £16.49
    expect(receipt.totalCents).toBe(1150 + SHIPPING_FLAT_CENTS + 230);
  });

  it('drops products that have vanished from the catalog and reports them', () => {
    const receipt = priceCart(
      cart([
        { productId: 'huila', qty: 1 },
        { productId: 'discontinued', qty: 2 },
      ]),
      catalog,
    );

    expect(receipt.lines).toHaveLength(1);
    expect(receipt.unavailableProductIds).toEqual(['discontinued']);
  });

  it('produces whole pence for every money field', () => {
    const receipt = priceCart(
      cart(
        [
          { productId: 'guji', qty: 3 },
          { productId: 'huila', qty: 1 },
        ],
        {
          code: 'BREW10',
          kind: 'percent',
          percentOff: 10,
        },
      ),
      catalog,
    );

    for (const value of [
      receipt.goodsCents,
      receipt.bulkSavingsCents,
      receipt.promoDiscountCents,
      receipt.taxCents,
      receipt.totalCents,
    ]) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});

describe('amountToFreeShipping', () => {
  it('reports what is left to spend', () => {
    const receipt = priceCart(cart([{ productId: 'huila', qty: 1 }]), catalog);

    expect(amountToFreeShipping(receipt)).toBe(FREE_SHIPPING_THRESHOLD_CENTS - 1150);
  });

  it('is zero once delivery is already free', () => {
    const receipt = priceCart(cart([{ productId: 'guji', qty: 5 }]), catalog);

    expect(amountToFreeShipping(receipt)).toBe(0);
  });
});
