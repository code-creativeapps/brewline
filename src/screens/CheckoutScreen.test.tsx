import { screen, userEvent, waitFor } from '@testing-library/react-native';

import { CardDeclinedError, HttpError, SessionExpiredError } from '../api/errors';
import { SEED_CATALOG } from '../api/fake-client';
import type { Order } from '../api/types';
import { useCartStore } from '../state/cart-store';
import { useOrderStore } from '../state/order-store';
import { deferred, renderScreen, stubApi } from '../test/render';
import { mockRouter } from '../test/router';

import { CheckoutScreen } from './CheckoutScreen';

const catalog = () => SEED_CATALOG.map((p) => ({ ...p }));
const api = (overrides = {}) =>
  stubApi({ listProducts: jest.fn(async () => catalog()), ...overrides });

const VALID = {
  name: 'Karim M',
  email: 'karim@example.com',
  card: '4242424242424242',
  expiry: '1230',
  cvc: '123',
};

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  overrides: Partial<typeof VALID> = {},
) {
  const values = { ...VALID, ...overrides };
  await user.type(screen.getByLabelText('Name on card'), values.name);
  await user.type(screen.getByLabelText('Email'), values.email);
  await user.type(screen.getByLabelText('Card number'), values.card);
  await user.type(screen.getByLabelText('Expiry'), values.expiry);
  await user.type(screen.getByLabelText('CVC'), values.cvc);
}

/** £9.50 goods + £4.99 delivery + £1.90 VAT = £16.39. */
function givenBasket() {
  useCartStore.getState().addItem('house-espresso', 1);
}

describe('CheckoutScreen', () => {
  it('shows the total the customer is about to pay', async () => {
    givenBasket();
    await renderScreen(<CheckoutScreen />, { api: api() });

    expect(await screen.findByTestId('checkout-total')).toHaveTextContent('£16.39');
    expect(screen.getByTestId('pay-button')).toHaveTextContent('Pay £16.39');
  });

  it('refuses to render a payment form for an empty basket', async () => {
    await renderScreen(<CheckoutScreen />, { api: api() });

    expect(await screen.findByTestId('empty-state')).toBeVisible();
    expect(screen.queryByTestId('pay-button')).toBeNull();
  });

  describe('validation', () => {
    it('stays quiet until the customer leaves a field', async () => {
      const user = userEvent.setup();
      givenBasket();
      await renderScreen(<CheckoutScreen />, { api: api() });
      await screen.findByTestId('pay-button');

      // skipBlur: the customer is still in the field, mid-typo.
      await user.type(screen.getByLabelText('Email'), 'not-an-email', { skipBlur: true });

      expect(screen.queryByTestId('field-email-error')).toBeNull();
    });

    it('reports a bad email once the field is blurred', async () => {
      const user = userEvent.setup();
      givenBasket();
      await renderScreen(<CheckoutScreen />, { api: api() });
      await screen.findByTestId('pay-button');

      await user.type(screen.getByLabelText('Email'), 'not-an-email');

      expect(await screen.findByTestId('field-email-error')).toHaveTextContent(
        'Enter a valid email address',
      );
    });

    it('surfaces every problem at once when Pay is pressed on an empty form', async () => {
      const user = userEvent.setup();
      givenBasket();
      const createOrder = jest.fn();
      await renderScreen(<CheckoutScreen />, { api: api({ createOrder }) });
      await screen.findByTestId('pay-button');

      await user.press(screen.getByTestId('pay-button'));

      expect(await screen.findByTestId('field-name-error')).toBeVisible();
      expect(screen.getByTestId('field-email-error')).toBeVisible();
      expect(screen.getByTestId('field-card-error')).toBeVisible();
      expect(screen.getByTestId('field-expiry-error')).toBeVisible();
      expect(screen.getByTestId('field-cvc-error')).toBeVisible();
      // The important half: nothing was sent to the payment API.
      expect(createOrder).not.toHaveBeenCalled();
    });

    it('rejects a card that fails the checksum without calling the API', async () => {
      const user = userEvent.setup();
      givenBasket();
      const createOrder = jest.fn();
      await renderScreen(<CheckoutScreen />, { api: api({ createOrder }) });
      await screen.findByTestId('pay-button');

      await fillForm(user, { card: '4242424242424224' });
      await user.press(screen.getByTestId('pay-button'));

      expect(await screen.findByTestId('field-card-error')).toHaveTextContent(
        'Check your card number',
      );
      expect(createOrder).not.toHaveBeenCalled();
    });

    it('formats the card number into groups of four as it is typed', async () => {
      const user = userEvent.setup();
      givenBasket();
      await renderScreen(<CheckoutScreen />, { api: api() });
      await screen.findByTestId('pay-button');

      await user.type(screen.getByLabelText('Card number'), '4242424242424242');

      expect(screen.getByLabelText('Card number')).toHaveDisplayValue('4242 4242 4242 4242');
    });

    it('inserts the slash into the expiry as it is typed', async () => {
      const user = userEvent.setup();
      givenBasket();
      await renderScreen(<CheckoutScreen />, { api: api() });
      await screen.findByTestId('pay-button');

      await user.type(screen.getByLabelText('Expiry'), '1230');

      expect(screen.getByLabelText('Expiry')).toHaveDisplayValue('12/30');
    });
  });

  describe('payment', () => {
    it('sends the basket, the promo and the computed total, then confirms', async () => {
      const user = userEvent.setup();
      givenBasket();
      useCartStore.getState().applyPromo({ code: 'FREESHIP', kind: 'free_shipping' });
      const order: Order = {
        id: 'ord_9',
        reference: 'BRW-1009',
        totalCents: 1140,
        email: 'karim@example.com',
        etaDays: 3,
      };
      const createOrder = jest.fn(async () => order);
      await renderScreen(<CheckoutScreen />, { api: api({ createOrder }) });
      await screen.findByTestId('pay-button');

      await fillForm(user);
      await user.press(screen.getByTestId('pay-button'));

      await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));
      expect(createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: [{ productId: 'house-espresso', qty: 1 }],
          promoCode: 'FREESHIP',
          email: 'karim@example.com',
          totalCents: 1140, // £9.50 + £1.90 VAT, delivery waived
        }),
      );
      expect(mockRouter.replace).toHaveBeenCalledWith('/order/ord_9');
    });

    it('empties the basket only after the payment succeeds', async () => {
      const user = userEvent.setup();
      givenBasket();
      const pending = deferred<Order>();
      await renderScreen(<CheckoutScreen />, {
        api: api({ createOrder: jest.fn(() => pending.promise) }),
      });
      await screen.findByTestId('pay-button');
      await fillForm(user);

      await user.press(screen.getByTestId('pay-button'));

      await waitFor(() => expect(screen.getByTestId('pay-button')).toBeDisabled());
      expect(useCartStore.getState().cart.lines).toHaveLength(1);

      pending.resolve({
        id: 'ord_1',
        reference: 'BRW-1001',
        totalCents: 1639,
        email: 'karim@example.com',
        etaDays: 3,
      });

      await waitFor(() => expect(useCartStore.getState().cart.lines).toHaveLength(0));
    });

    it('records the order so the confirmation screen can find it by id', async () => {
      const user = userEvent.setup();
      givenBasket();
      await renderScreen(<CheckoutScreen />, { api: api() });
      await screen.findByTestId('pay-button');

      await fillForm(user);
      await user.press(screen.getByTestId('pay-button'));

      await waitFor(() => expect(useOrderStore.getState().orders.ord_1).toBeDefined());
    });

    it('shows the processor reason on a declined card and keeps the basket', async () => {
      const user = userEvent.setup();
      givenBasket();
      const createOrder = jest
        .fn()
        .mockRejectedValue(new CardDeclinedError('Your card was declined. Try a different card.'));
      await renderScreen(<CheckoutScreen />, { api: api({ createOrder }) });
      await screen.findByTestId('pay-button');

      await fillForm(user, { card: '4000000000000002' });
      await user.press(screen.getByTestId('pay-button'));

      expect(await screen.findByTestId('payment-error')).toHaveTextContent(
        'Your card was declined. Try a different card.',
      );
      expect(useCartStore.getState().cart.lines).toHaveLength(1);
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it('reassures the customer that no money moved when the request fails', async () => {
      const user = userEvent.setup();
      givenBasket();
      const createOrder = jest.fn().mockRejectedValue(new HttpError(500));
      await renderScreen(<CheckoutScreen />, { api: api({ createOrder }) });
      await screen.findByTestId('pay-button');

      await fillForm(user);
      await user.press(screen.getByTestId('pay-button'));

      expect(await screen.findByTestId('payment-error')).toHaveTextContent(
        /No money has left your account/,
      );
    });

    it('tells the customer to sign in again when the session died mid-checkout', async () => {
      const user = userEvent.setup();
      givenBasket();
      const createOrder = jest.fn().mockRejectedValue(new SessionExpiredError());
      await renderScreen(<CheckoutScreen />, { api: api({ createOrder }) });
      await screen.findByTestId('pay-button');

      await fillForm(user);
      await user.press(screen.getByTestId('pay-button'));

      expect(await screen.findByTestId('payment-error')).toHaveTextContent(/Your session expired/);
    });

    it('cannot be double-submitted while a payment is in flight', async () => {
      const user = userEvent.setup();
      givenBasket();
      const pending = deferred<Order>();
      const createOrder = jest.fn(() => pending.promise);
      await renderScreen(<CheckoutScreen />, { api: api({ createOrder }) });
      await screen.findByTestId('pay-button');
      await fillForm(user);

      await user.press(screen.getByTestId('pay-button'));
      await waitFor(() => expect(screen.getByTestId('pay-button')).toBeDisabled());
      await user.press(screen.getByTestId('pay-button'));

      expect(createOrder).toHaveBeenCalledTimes(1);
    });
  });
});
