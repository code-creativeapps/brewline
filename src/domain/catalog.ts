export type Roast = 'light' | 'medium' | 'dark';

export type Product = {
  id: string;
  name: string;
  origin: string;
  roast: Roast;
  priceCents: number;
  /** Optional "buy N, get X% off this line" rule attached to the product. */
  bulkDiscount?: { minQty: number; percentOff: number };
};

export type Catalog = readonly Product[];

export function findProduct(catalog: Catalog, id: string): Product | undefined {
  return catalog.find((p) => p.id === id);
}
