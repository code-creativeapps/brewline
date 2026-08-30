import { create } from 'zustand';

import type { Order } from '../api/types';

type OrderStore = {
  orders: Record<string, Order>;
  recordOrder: (order: Order) => void;
};

/**
 * The confirmation screen is reachable by deep link, so it reads the order from
 * here by id rather than trusting navigation params it may not have.
 */
export const useOrderStore = create<OrderStore>((set) => ({
  orders: {},
  recordOrder: (order) => set((state) => ({ orders: { ...state.orders, [order.id]: order } })),
}));

export function resetOrderStore() {
  useOrderStore.setState({ orders: {} });
}
