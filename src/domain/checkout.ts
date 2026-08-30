export type CheckoutForm = {
  name: string;
  email: string;
  cardNumber: string;
  expiry: string;
  cvc: string;
};

export type CheckoutField = keyof CheckoutForm;
export type CheckoutErrors = Partial<Record<CheckoutField, string>>;

export const EMPTY_CHECKOUT_FORM: CheckoutForm = {
  name: '',
  email: '',
  cardNumber: '',
  expiry: '',
  cvc: '',
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/** Luhn checksum — catches transposed digits before we ever hit the network. */
export function isLuhnValid(cardNumber: string): boolean {
  const digits = digitsOnly(cardNumber);
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Format as the user types: 4242424242424242 -> "4242 4242 4242 4242". */
export function formatCardNumber(value: string): string {
  return digitsOnly(value)
    .slice(0, 19)
    .replace(/(.{4})/g, '$1 ')
    .trim();
}

export function formatExpiry(value: string): string {
  const digits = digitsOnly(value).slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/** `now` is injected so "card expired" tests don't rot with the calendar. */
export function isExpiryValid(expiry: string, now: Date): boolean {
  const match = /^(\d{2})\/(\d{2})$/.exec(expiry.trim());
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return false;
  // A card is valid through the last instant of its expiry month.
  const expiresAt = new Date(Date.UTC(year, month, 1));
  return expiresAt.getTime() > now.getTime();
}

export function validateCheckout(form: CheckoutForm, now: Date): CheckoutErrors {
  const errors: CheckoutErrors = {};

  if (form.name.trim().length < 2) errors.name = 'Enter the name on the card';
  if (!EMAIL.test(form.email.trim())) errors.email = 'Enter a valid email address';
  if (!isLuhnValid(form.cardNumber)) errors.cardNumber = 'Check your card number';
  if (!isExpiryValid(form.expiry, now)) errors.expiry = 'Expiry must be MM/YY in the future';
  if (!/^\d{3,4}$/.test(form.cvc.trim())) errors.cvc = 'CVC is 3 or 4 digits';

  return errors;
}

export function isCheckoutValid(form: CheckoutForm, now: Date): boolean {
  return Object.keys(validateCheckout(form, now)).length === 0;
}
