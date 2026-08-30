import { formatMoney, percentOf, roundCents } from './money';

describe('formatMoney', () => {
  it.each([
    [0, '£0.00'],
    [5, '£0.05'],
    [99, '£0.99'],
    [100, '£1.00'],
    [123456, '£1234.56'],
    [-499, '-£4.99'],
  ])('formats %i as %s', (cents, expected) => {
    expect(formatMoney(cents)).toBe(expected);
  });
});

describe('roundCents', () => {
  it('rounds halves away from zero in both directions', () => {
    expect(roundCents(0.5)).toBe(1);
    expect(roundCents(1.5)).toBe(2);
    expect(roundCents(-0.5)).toBe(-1);
  });
});

describe('percentOf', () => {
  it('rounds the result to whole pence', () => {
    // 10% of £11.55 is 115.5p — a customer is never charged half a penny.
    expect(percentOf(1155, 10)).toBe(116);
  });

  it('returns 0 for a 0% discount', () => {
    expect(percentOf(1155, 0)).toBe(0);
  });
});
