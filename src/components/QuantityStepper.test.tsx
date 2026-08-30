import { render, screen, userEvent } from '@testing-library/react-native';

import { MAX_QTY_PER_LINE } from '../domain/cart';

import { QuantityStepper } from './QuantityStepper';

const setup = async (qty: number) => {
  const onChange = jest.fn();
  await render(<QuantityStepper testID="qty" label="Guji" qty={qty} onChange={onChange} />);
  return { onChange, user: userEvent.setup() };
};

describe('QuantityStepper', () => {
  it('shows the current quantity', async () => {
    await setup(3);

    expect(screen.getByTestId('qty-value')).toHaveTextContent('3');
  });

  it('asks for one more when incremented', async () => {
    const { onChange, user } = await setup(3);

    await user.press(screen.getByLabelText('Increase quantity of Guji'));

    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('asks for one fewer when decremented', async () => {
    const { onChange, user } = await setup(3);

    await user.press(screen.getByLabelText('Decrease quantity of Guji'));

    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('can be decremented to zero — the cart decides that means "remove"', async () => {
    const { onChange, user } = await setup(1);

    await user.press(screen.getByLabelText('Decrease quantity of Guji'));

    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('disables incrementing at the per-line maximum', async () => {
    const { onChange, user } = await setup(MAX_QTY_PER_LINE);
    const increment = screen.getByLabelText('Increase quantity of Guji');

    expect(increment).toBeDisabled();
    await user.press(increment);

    expect(onChange).not.toHaveBeenCalled();
  });
});
