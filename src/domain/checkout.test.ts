import {
  EMPTY_CHECKOUT_FORM,
  formatCardNumber,
  formatExpiry,
  isExpiryValid,
  isLuhnValid,
  validateCheckout,
  type CheckoutForm,
} from './checkout';

const NOW = new Date('2026-08-29T12:00:00Z');

const validForm: CheckoutForm = {
  name: 'Karim M',
  email: 'karim@example.com',
  cardNumber: '4242 4242 4242 4242',
  expiry: '12/30',
  cvc: '123',
};

describe('isLuhnValid', () => {
  it('accepts a well-known valid test card, spaced or not', () => {
    expect(isLuhnValid('4242424242424242')).toBe(true);
    expect(isLuhnValid('4242 4242 4242 4242')).toBe(true);
  });

  it('rejects a card with two digits transposed', () => {
    expect(isLuhnValid('4242424242424224')).toBe(false);
  });

  it('rejects numbers that are too short or too long', () => {
    expect(isLuhnValid('4242')).toBe(false);
    expect(isLuhnValid('4'.repeat(20))).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isLuhnValid('')).toBe(false);
  });
});

describe('formatCardNumber', () => {
  it('groups digits in fours and strips anything else', () => {
    expect(formatCardNumber('4242abc42424242')).toBe('4242 4242 4242');
  });
});

describe('formatExpiry', () => {
  it.each([
    ['1', '1'],
    ['12', '12'],
    ['123', '12/3'],
    ['1230', '12/30'],
    ['12/30', '12/30'],
  ])('formats %s as %s', (input, expected) => {
    expect(formatExpiry(input)).toBe(expected);
  });
});

describe('isExpiryValid', () => {
  it('accepts a future date', () => {
    expect(isExpiryValid('12/30', NOW)).toBe(true);
  });

  it('accepts the current month — a card is good until the month ends', () => {
    expect(isExpiryValid('08/26', NOW)).toBe(true);
  });

  it('rejects last month', () => {
    expect(isExpiryValid('07/26', NOW)).toBe(false);
  });

  it('rejects a month outside 1-12', () => {
    expect(isExpiryValid('13/30', NOW)).toBe(false);
    expect(isExpiryValid('00/30', NOW)).toBe(false);
  });

  it('rejects anything that is not MM/YY', () => {
    expect(isExpiryValid('2030-12', NOW)).toBe(false);
  });
});

describe('validateCheckout', () => {
  it('reports nothing for a complete, valid form', () => {
    expect(validateCheckout(validForm, NOW)).toEqual({});
  });

  it('reports every empty field at once', () => {
    expect(Object.keys(validateCheckout(EMPTY_CHECKOUT_FORM, NOW)).sort()).toEqual([
      'cardNumber',
      'cvc',
      'email',
      'expiry',
      'name',
    ]);
  });

  it.each([
    ['no at-sign', 'karim.example.com'],
    ['no domain dot', 'karim@example'],
    ['spaces', 'kar im@example.com'],
  ])('rejects an email with %s', (_case, email) => {
    expect(validateCheckout({ ...validForm, email }, NOW)).toHaveProperty('email');
  });

  it('ignores surrounding whitespace on name and email', () => {
    expect(
      validateCheckout({ ...validForm, name: '  Karim  ', email: ' karim@example.com ' }, NOW),
    ).toEqual({});
  });

  it('accepts a 4-digit CVC (Amex)', () => {
    expect(validateCheckout({ ...validForm, cvc: '1234' }, NOW)).toEqual({});
  });

  it('rejects a CVC with letters', () => {
    expect(validateCheckout({ ...validForm, cvc: '12a' }, NOW)).toHaveProperty('cvc');
  });
});
