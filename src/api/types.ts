import type { Product } from '../domain/catalog';
import type { Promo } from '../domain/promo';

export type OrderDraft = {
  lines: { productId: string; qty: number }[];
  promoCode?: string;
  email: string;
  name: string;
  card: { number: string; expiry: string; cvc: string };
  totalCents: number;
};

export type Order = {
  id: string;
  reference: string;
  totalCents: number;
  email: string;
  etaDays: number;
};

export type ApiClient = {
  listProducts(signal?: AbortSignal): Promise<Product[]>;
  validatePromo(code: string, signal?: AbortSignal): Promise<Promo>;
  createOrder(draft: OrderDraft, signal?: AbortSignal): Promise<Order>;
};
