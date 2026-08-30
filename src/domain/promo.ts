export type Promo =
  | { code: string; kind: 'percent'; percentOff: number }
  | { code: string; kind: 'fixed'; amountCents: number }
  | { code: string; kind: 'free_shipping' };

export function normalisePromoCode(input: string): string {
  return input.trim().toUpperCase();
}
