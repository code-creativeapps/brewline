/**
 * Money is always integer minor units (pence). Never floats — 0.1 + 0.2 bugs
 * in a checkout total are the kind of thing you only find in production.
 */
export type Cents = number;

export const CURRENCY_SYMBOL = '£';

/** Round half-up, and away from zero for negatives. `Math.round` rounds -0.5 to -0. */
export function roundCents(value: number): Cents {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/** Apply a percentage (0-100) and round to whole pence. */
export function percentOf(amount: Cents, percent: number): Cents {
  return roundCents((amount * percent) / 100);
}

/**
 * Hand-rolled rather than `Intl.NumberFormat` on purpose: the output is part of
 * the contract our tests and Maestro flows assert on, so it must not shift with
 * the device locale or an engine's ICU build.
 */
export function formatMoney(cents: Cents): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  const major = Math.floor(abs / 100);
  const minor = String(abs % 100).padStart(2, '0');
  return `${negative ? '-' : ''}${CURRENCY_SYMBOL}${major}.${minor}`;
}
