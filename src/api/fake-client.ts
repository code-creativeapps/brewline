import type { Product } from '../domain/catalog';
import { normalisePromoCode, type Promo } from '../domain/promo';

import { CardDeclinedError, PromoInvalidError } from './errors';
import type { ApiClient, Order, OrderDraft } from './types';

/**
 * An in-memory stand-in for the real backend. It backs `npm start` and, more
 * importantly, the `e2e` build profile: Maestro flows run against this so the
 * suite asserts our app's behaviour rather than the staging server's uptime.
 */
export const SEED_CATALOG: Product[] = [
  {
    id: 'ethiopia-guji',
    name: 'Ethiopia Guji',
    origin: 'Guji, Ethiopia',
    roast: 'light',
    priceCents: 1400,
    bulkDiscount: { minQty: 3, percentOff: 10 },
  },
  {
    id: 'colombia-huila',
    name: 'Colombia Huila',
    origin: 'Huila, Colombia',
    roast: 'medium',
    priceCents: 1150,
  },
  {
    id: 'sumatra-lintong',
    name: 'Sumatra Lintong',
    origin: 'Lintong, Sumatra',
    roast: 'dark',
    priceCents: 1250,
    bulkDiscount: { minQty: 2, percentOff: 5 },
  },
  {
    id: 'house-espresso',
    name: 'House Espresso',
    origin: 'Blend',
    roast: 'medium',
    priceCents: 950,
  },
];

export const SEED_PROMOS: Record<string, Promo> = {
  BREW10: { code: 'BREW10', kind: 'percent', percentOff: 10 },
  FIVEOFF: { code: 'FIVEOFF', kind: 'fixed', amountCents: 500 },
  FREESHIP: { code: 'FREESHIP', kind: 'free_shipping' },
};

/** Test card that the payment processor always refuses. */
export const DECLINED_CARD_SUFFIX = '0002';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createFakeApiClient(latencyMs = 250): ApiClient {
  let orderSeq = 0;

  return {
    async listProducts() {
      await sleep(latencyMs);
      return SEED_CATALOG.map((p) => ({ ...p }));
    },

    async validatePromo(code) {
      await sleep(latencyMs);
      const promo = SEED_PROMOS[normalisePromoCode(code)];
      if (!promo) throw new PromoInvalidError(normalisePromoCode(code));
      return promo;
    },

    async createOrder(draft: OrderDraft): Promise<Order> {
      await sleep(latencyMs);
      const digits = draft.card.number.replace(/\D/g, '');
      if (digits.endsWith(DECLINED_CARD_SUFFIX)) {
        throw new CardDeclinedError('Your card was declined. Try a different card.');
      }
      orderSeq += 1;
      return {
        id: `ord_${orderSeq}`,
        reference: `BRW-${String(1000 + orderSeq)}`,
        totalCents: draft.totalCents,
        email: draft.email,
        etaDays: 3,
      };
    },
  };
}
