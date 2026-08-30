import { screen, userEvent, waitFor } from '@testing-library/react-native';

import { HttpError, PromoInvalidError } from '../api/errors';
import { SEED_CATALOG, SEED_PROMOS } from '../api/fake-client';
import { useCartStore } from '../state/cart-store';
import { renderScreen, stubApi } from '../test/render';
import { mockRouter } from '../test/router';

import { CartScreen } from './CartScreen';

const catalog = () => SEED_CATALOG.map((p) => ({ ...p }));
const api = (overrides = {}) =>
  stubApi({ listProducts: jest.fn(async () => catalog()), ...overrides });

/** Seed the basket through the real store, so tests exercise the real events. */
function givenBasket(...items: [productId: string, qty: number][]) {
  items.forEach(([productId, qty]) => useCartStore.getState().addItem(productId, qty));
}

describe('CartScreen', () => {
  it('tells the customer the basket is empty rather than showing a £0 receipt', async () => {
    await renderScreen(<CartScreen />, { api: api() });

    expect(await screen.findByTestId('empty-state')).toBeVisible();
    expect(screen.getByText('Your basket is empty')).toBeVisible();
  });

  it('prices the basket: goods, delivery, VAT and total', async () => {
    givenBasket(['house-espresso', 1]); // £9.50
    await renderScreen(<CartScreen />, { api: api() });

    expect(await screen.findByTestId('total-goods')).toHaveTextContent('£9.50');
    expect(screen.getByTestId('total-shipping')).toHaveTextContent('£4.99');
    expect(screen.getByTestId('total-tax')).toHaveTextContent('£1.90');
    expect(screen.getByTestId('total-due')).toHaveTextContent('£16.39');
  });

  it('shows the bulk saving once the quantity threshold is crossed', async () => {
    const user = userEvent.setup();
    givenBasket(['ethiopia-guji', 2]);
    await renderScreen(<CartScreen />, { api: api() });
    await screen.findByTestId('cart-line-ethiopia-guji');

    expect(screen.queryByTestId('cart-line-ethiopia-guji-bulk')).toBeNull();
    await user.press(screen.getByLabelText('Increase quantity of Ethiopia Guji'));

    expect(await screen.findByTestId('cart-line-ethiopia-guji-bulk')).toHaveTextContent(/−£4\.20$/);
  });

  it('switches delivery to free once the threshold is reached', async () => {
    givenBasket(['ethiopia-guji', 3]); // £42 - £4.20 = £37.80
    await renderScreen(<CartScreen />, { api: api() });

    expect(await screen.findByTestId('total-shipping')).toHaveTextContent('Free');
    expect(screen.queryByTestId('free-shipping-hint')).toBeNull();
  });

  it('tells the customer how much more to spend for free delivery', async () => {
    givenBasket(['house-espresso', 1]);
    await renderScreen(<CartScreen />, { api: api() });

    expect(await screen.findByTestId('free-shipping-hint')).toHaveTextContent(/Spend £25\.50 more/);
  });

  it('removes a line and falls back to the empty state', async () => {
    const user = userEvent.setup();
    givenBasket(['house-espresso', 1]);
    await renderScreen(<CartScreen />, { api: api() });
    await screen.findByTestId('cart-line-house-espresso');

    await user.press(screen.getByLabelText('Remove House Espresso'));

    expect(await screen.findByTestId('empty-state')).toBeVisible();
  });

  it('decrementing to zero removes the line', async () => {
    const user = userEvent.setup();
    givenBasket(['house-espresso', 1]);
    await renderScreen(<CartScreen />, { api: api() });
    await screen.findByTestId('cart-line-house-espresso');

    await user.press(screen.getByLabelText('Decrease quantity of House Espresso'));

    expect(await screen.findByTestId('empty-state')).toBeVisible();
  });

  describe('promo codes', () => {
    it('applies a valid code and shows the discount line', async () => {
      const user = userEvent.setup();
      givenBasket(['house-espresso', 2]); // £19.00
      const validatePromo = jest.fn(async () => SEED_PROMOS.BREW10);
      await renderScreen(<CartScreen />, { api: api({ validatePromo }) });
      await screen.findByTestId('promo-input');

      await user.type(screen.getByLabelText('Promo code'), 'brew10');
      await user.press(screen.getByTestId('apply-promo'));

      expect(await screen.findByTestId('total-promo')).toHaveTextContent('−£1.90');
      expect(screen.getByTestId('applied-promo')).toHaveTextContent('BREW10 applied');
      // The code is normalised before it reaches the API.
      expect(validatePromo).toHaveBeenCalledWith('BREW10');
    });

    it('shows the code back to the customer when it is rejected', async () => {
      const user = userEvent.setup();
      givenBasket(['house-espresso', 1]);
      const validatePromo = jest.fn().mockRejectedValue(new PromoInvalidError('NOPE'));
      await renderScreen(<CartScreen />, { api: api({ validatePromo }) });
      await screen.findByTestId('promo-input');

      await user.type(screen.getByLabelText('Promo code'), 'NOPE');
      await user.press(screen.getByTestId('apply-promo'));

      expect(await screen.findByTestId('promo-error')).toHaveTextContent(
        '“NOPE” is not a valid code',
      );
      expect(screen.queryByTestId('total-promo')).toBeNull();
    });

    it('falls back to a generic message when the promo service itself fails', async () => {
      const user = userEvent.setup();
      givenBasket(['house-espresso', 1]);
      const validatePromo = jest.fn().mockRejectedValue(new HttpError(503));
      await renderScreen(<CartScreen />, { api: api({ validatePromo }) });
      await screen.findByTestId('promo-input');

      await user.type(screen.getByLabelText('Promo code'), 'BREW10');
      await user.press(screen.getByTestId('apply-promo'));

      expect(await screen.findByTestId('promo-error')).toHaveTextContent(
        /We couldn't check that code/,
      );
    });

    it('will not submit an empty code', async () => {
      givenBasket(['house-espresso', 1]);
      const validatePromo = jest.fn();
      await renderScreen(<CartScreen />, { api: api({ validatePromo }) });

      expect(await screen.findByTestId('apply-promo')).toBeDisabled();
      expect(validatePromo).not.toHaveBeenCalled();
    });

    it('a free-shipping code zeroes delivery without discounting the goods', async () => {
      const user = userEvent.setup();
      givenBasket(['house-espresso', 1]);
      await renderScreen(<CartScreen />, {
        api: api({ validatePromo: jest.fn(async () => SEED_PROMOS.FREESHIP) }),
      });
      await screen.findByTestId('promo-input');

      await user.type(screen.getByLabelText('Promo code'), 'FREESHIP');
      await user.press(screen.getByTestId('apply-promo'));

      await waitFor(() => expect(screen.getByTestId('total-shipping')).toHaveTextContent('Free'));
      expect(screen.getByTestId('total-goods')).toHaveTextContent('£9.50');
      expect(screen.queryByTestId('total-promo')).toBeNull();
    });

    it('removing the code restores the original total', async () => {
      const user = userEvent.setup();
      givenBasket(['house-espresso', 2]);
      await renderScreen(<CartScreen />, {
        api: api({ validatePromo: jest.fn(async () => SEED_PROMOS.BREW10) }),
      });
      await screen.findByTestId('promo-input');
      await user.type(screen.getByLabelText('Promo code'), 'BREW10');
      await user.press(screen.getByTestId('apply-promo'));
      await screen.findByTestId('applied-promo');

      await user.press(screen.getByLabelText('Remove code'));

      expect(await screen.findByTestId('promo-input')).toBeVisible();
      expect(screen.queryByTestId('total-promo')).toBeNull();
    });
  });

  it('warns when a basket item is no longer in the catalog', async () => {
    givenBasket(['house-espresso', 1], ['discontinued-blend', 1]);
    await renderScreen(<CartScreen />, { api: api() });

    expect(await screen.findByTestId('unavailable-notice')).toHaveTextContent(
      /1 item\(s\) sold out/,
    );
  });

  it('goes to checkout', async () => {
    const user = userEvent.setup();
    givenBasket(['house-espresso', 1]);
    await renderScreen(<CartScreen />, { api: api() });
    await screen.findByTestId('go-to-checkout');

    await user.press(screen.getByTestId('go-to-checkout'));

    expect(mockRouter.push).toHaveBeenCalledWith('/checkout');
  });
});
