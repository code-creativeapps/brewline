import { screen, userEvent, waitFor } from '@testing-library/react-native';

import { HttpError, SessionExpiredError } from '../api/errors';
import { SEED_CATALOG } from '../api/fake-client';
import { deferred, renderScreen, stubApi } from '../test/render';
import { mockRouter } from '../test/router';
import { useCartStore } from '../state/cart-store';

import { CatalogScreen } from './CatalogScreen';

const catalog = () => SEED_CATALOG.map((p) => ({ ...p }));

describe('CatalogScreen', () => {
  it('shows a loading state while the catalog is in flight', async () => {
    const pending = deferred<typeof SEED_CATALOG>();
    await renderScreen(<CatalogScreen />, {
      api: stubApi({ listProducts: jest.fn(() => pending.promise) }),
    });

    expect(screen.getByTestId('loading-state')).toBeVisible();

    pending.resolve(catalog());
    await waitFor(() => expect(screen.queryByTestId('loading-state')).toBeNull());
  });

  it('lists the coffees with their prices once loaded', async () => {
    await renderScreen(<CatalogScreen />, {
      api: stubApi({ listProducts: jest.fn(async () => catalog()) }),
    });

    expect(await screen.findByText('Ethiopia Guji')).toBeVisible();
    expect(screen.getByText('£14.00')).toBeVisible();
    expect(screen.getByText('10% off 3+ bags')).toBeVisible();
  });

  it('adds a product to the basket and reflects it in the button', async () => {
    const user = userEvent.setup();
    await renderScreen(<CatalogScreen />, {
      api: stubApi({ listProducts: jest.fn(async () => catalog()) }),
    });
    await screen.findByText('Ethiopia Guji');

    await user.press(screen.getByLabelText('Add Ethiopia Guji'));

    expect(await screen.findByTestId('product-ethiopia-guji-in-cart')).toHaveTextContent(
      '1 in basket',
    );
    expect(screen.getByTestId('view-basket')).toHaveTextContent('View basket (1)');
  });

  it('accumulates repeated adds into a single line', async () => {
    const user = userEvent.setup();
    await renderScreen(<CatalogScreen />, {
      api: stubApi({ listProducts: jest.fn(async () => catalog()) }),
    });
    await screen.findByText('Ethiopia Guji');

    await user.press(screen.getByLabelText('Add Ethiopia Guji'));
    await user.press(screen.getByLabelText('Add Ethiopia Guji'));

    expect(useCartStore.getState().cart.lines).toEqual([{ productId: 'ethiopia-guji', qty: 2 }]);
  });

  it('hides the basket bar until something is in the basket', async () => {
    await renderScreen(<CatalogScreen />, {
      api: stubApi({ listProducts: jest.fn(async () => catalog()) }),
    });
    await screen.findByText('Ethiopia Guji');

    expect(screen.queryByTestId('view-basket')).toBeNull();
  });

  it('navigates to the basket', async () => {
    const user = userEvent.setup();
    await renderScreen(<CatalogScreen />, {
      api: stubApi({ listProducts: jest.fn(async () => catalog()) }),
    });
    await screen.findByText('Ethiopia Guji');
    await user.press(screen.getByLabelText('Add Ethiopia Guji'));

    await user.press(screen.getByTestId('view-basket'));

    expect(mockRouter.push).toHaveBeenCalledWith('/cart');
  });

  it('offers a retry that refetches after a server error', async () => {
    const user = userEvent.setup();
    const listProducts = jest
      .fn()
      .mockRejectedValueOnce(new HttpError(500))
      .mockResolvedValueOnce(catalog());
    await renderScreen(<CatalogScreen />, { api: stubApi({ listProducts }) });

    expect(await screen.findByTestId('error-state')).toBeVisible();
    await user.press(screen.getByTestId('retry-button'));

    expect(await screen.findByText('Ethiopia Guji')).toBeVisible();
    expect(listProducts).toHaveBeenCalledTimes(2);
  });

  it('sends an expired session to sign-in instead of offering a pointless retry', async () => {
    const user = userEvent.setup();
    const listProducts = jest.fn().mockRejectedValue(new SessionExpiredError());
    await renderScreen(<CatalogScreen />, { api: stubApi({ listProducts }) });

    expect(await screen.findByText('Your session has expired')).toBeVisible();
    await user.press(screen.getByLabelText('Sign in'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/sign-in');
    expect(listProducts).toHaveBeenCalledTimes(1);
  });
});
