import type { CartState } from './cart';
import { findProduct, type Catalog, type Product } from './catalog';
import { percentOf, type Cents } from './money';
import type { Promo } from './promo';

export const SHIPPING_FLAT_CENTS = 499;
export const FREE_SHIPPING_THRESHOLD_CENTS = 3500;
export const TAX_PERCENT = 20;

export type ReceiptLine = {
  productId: string;
  name: string;
  qty: number;
  unitCents: Cents;
  /** Gross value of the line before any discount. */
  grossCents: Cents;
  /** Saving from the product's own bulk rule, if it applied. */
  bulkSavingCents: Cents;
  totalCents: Cents;
};

export type Receipt = {
  lines: ReceiptLine[];
  goodsCents: Cents;
  bulkSavingsCents: Cents;
  promoDiscountCents: Cents;
  shippingCents: Cents;
  taxCents: Cents;
  totalCents: Cents;
  /** Ids that were in the cart but no longer in the catalog — dropped, not fatal. */
  unavailableProductIds: string[];
};

function priceLine(product: Product, qty: number): ReceiptLine {
  const grossCents = product.priceCents * qty;
  const rule = product.bulkDiscount;
  const bulkSavingCents = rule && qty >= rule.minQty ? percentOf(grossCents, rule.percentOff) : 0;
  return {
    productId: product.id,
    name: product.name,
    qty,
    unitCents: product.priceCents,
    grossCents,
    bulkSavingCents,
    totalCents: grossCents - bulkSavingCents,
  };
}

function promoDiscount(promo: Promo | undefined, discountableCents: Cents): Cents {
  if (!promo) return 0;
  if (promo.kind === 'percent') return percentOf(discountableCents, promo.percentOff);
  // A fixed-value promo can never take the basket below zero.
  if (promo.kind === 'fixed') return Math.min(promo.amountCents, discountableCents);
  return 0;
}

/**
 * The single source of truth for what a customer pays. The cart screen, the
 * checkout screen and the order payload all read from this — no screen does its
 * own arithmetic.
 */
export function priceCart(cart: CartState, catalog: Catalog): Receipt {
  const unavailableProductIds: string[] = [];
  const lines: ReceiptLine[] = [];

  for (const line of cart.lines) {
    const product = findProduct(catalog, line.productId);
    if (!product) {
      unavailableProductIds.push(line.productId);
      continue;
    }
    lines.push(priceLine(product, line.qty));
  }

  const goodsCents = lines.reduce((sum, l) => sum + l.totalCents, 0);
  const bulkSavingsCents = lines.reduce((sum, l) => sum + l.bulkSavingCents, 0);
  const promoDiscountCents = promoDiscount(cart.promo, goodsCents);
  const netGoodsCents = goodsCents - promoDiscountCents;

  const earnedFreeShipping = netGoodsCents >= FREE_SHIPPING_THRESHOLD_CENTS;
  const promoFreeShipping = cart.promo?.kind === 'free_shipping';
  const shippingCents =
    lines.length === 0 || earnedFreeShipping || promoFreeShipping ? 0 : SHIPPING_FLAT_CENTS;

  // Tax is charged on goods only, after discounts — not on delivery.
  const taxCents = percentOf(netGoodsCents, TAX_PERCENT);

  return {
    lines,
    goodsCents,
    bulkSavingsCents,
    promoDiscountCents,
    shippingCents,
    taxCents,
    totalCents: netGoodsCents + shippingCents + taxCents,
    unavailableProductIds,
  };
}

/** How much more the customer must spend to stop paying for delivery. */
export function amountToFreeShipping(receipt: Receipt): Cents {
  if (receipt.shippingCents === 0) return 0;
  const net = receipt.goodsCents - receipt.promoDiscountCents;
  return Math.max(0, FREE_SHIPPING_THRESHOLD_CENTS - net);
}
