import { screen, userEvent } from '@testing-library/react-native';

import { useOrderStore } from '../state/order-store';
import { renderScreen, stubApi } from '../test/render';
import { mockRouter, mockSearchParams } from '../test/router';

import { OrderScreen } from './OrderScreen';

const order = {
  id: 'ord_9',
  reference: 'BRW-1009',
  totalCents: 1639,
  email: 'karim@example.com',
  etaDays: 3,
};

describe('OrderScreen', () => {
  it('confirms the order it was routed to', async () => {
    useOrderStore.getState().recordOrder(order);
    mockSearchParams.current = { id: 'ord_9' };
    await renderScreen(<OrderScreen />, { api: stubApi() });

    expect(screen.getByTestId('order-reference')).toHaveTextContent('BRW-1009');
    expect(screen.getByTestId('order-total')).toHaveTextContent('Paid £16.39');
    expect(screen.getByText(/karim@example.com/)).toBeVisible();
  });

  it('degrades gracefully when opened by a stale deep link', async () => {
    mockSearchParams.current = { id: 'ord_missing' };
    await renderScreen(<OrderScreen />, { api: stubApi() });

    expect(screen.getByTestId('empty-state')).toBeVisible();
    expect(screen.getByText('Order not found')).toBeVisible();
  });

  it('returns to the shop without leaving the confirmation on the stack', async () => {
    const user = userEvent.setup();
    useOrderStore.getState().recordOrder(order);
    mockSearchParams.current = { id: 'ord_9' };
    await renderScreen(<OrderScreen />, { api: stubApi() });

    await user.press(screen.getByTestId('back-to-shop'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });
});
