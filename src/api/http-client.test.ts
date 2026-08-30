import {
  failWith,
  hangFor,
  malformedJsonOn,
  networkErrorOn,
  TEST_API_URL,
} from '../test/msw-handlers';
import { server } from '../test/msw-server';

import { createHttpApiClient } from './http-client';
import {
  CardDeclinedError,
  HttpError,
  NetworkError,
  PromoInvalidError,
  SessionExpiredError,
  TimeoutError,
} from './errors';
import type { OrderDraft } from './types';

const api = createHttpApiClient({ baseUrl: TEST_API_URL, timeoutMs: 200 });

const draft: OrderDraft = {
  lines: [{ productId: 'ethiopia-guji', qty: 1 }],
  name: 'Karim M',
  email: 'karim@example.com',
  card: { number: '4242 4242 4242 4242', expiry: '12/30', cvc: '123' },
  totalCents: 2179,
};

describe('listProducts', () => {
  it('returns the catalog on success', async () => {
    const products = await api.listProducts();

    expect(products).toHaveLength(4);
    expect(products[0]).toMatchObject({ id: 'ethiopia-guji', priceCents: 1400 });
  });

  it('raises SessionExpiredError on 401 so the UI can route to sign-in', async () => {
    server.use(failWith('/products', 401));

    await expect(api.listProducts()).rejects.toBeInstanceOf(SessionExpiredError);
  });

  it('raises HttpError carrying the status on a 500', async () => {
    server.use(failWith('/products', 500, { message: 'Upstream exploded' }));

    await expect(api.listProducts()).rejects.toMatchObject({
      name: 'HttpError',
      status: 500,
      message: 'Upstream exploded',
    });
  });

  it('raises NetworkError when the request never leaves the device', async () => {
    server.use(networkErrorOn('/products'));

    await expect(api.listProducts()).rejects.toBeInstanceOf(NetworkError);
  });

  it('raises TimeoutError — not NetworkError — when the server is just slow', async () => {
    server.use(hangFor('/products', 1000));

    await expect(api.listProducts()).rejects.toBeInstanceOf(TimeoutError);
  });

  it('raises HttpError when a 200 body is not JSON (captive portal / HTML error page)', async () => {
    server.use(malformedJsonOn('/products'));

    await expect(api.listProducts()).rejects.toThrow(HttpError);
  });

  it('stops in-flight work when the caller aborts', async () => {
    server.use(hangFor('/products', 1000));
    const controller = new AbortController();
    const promise = api.listProducts(controller.signal);

    controller.abort();

    await expect(promise).rejects.toBeInstanceOf(NetworkError);
  });
});

describe('validatePromo', () => {
  it('returns the promo for a known code', async () => {
    await expect(api.validatePromo('BREW10')).resolves.toEqual({
      code: 'BREW10',
      kind: 'percent',
      percentOff: 10,
    });
  });

  it('raises PromoInvalidError naming the code on a 404', async () => {
    await expect(api.validatePromo('NOPE')).rejects.toMatchObject({
      name: 'PromoInvalidError',
      code: 'NOPE',
    });
    await expect(api.validatePromo('NOPE')).rejects.toBeInstanceOf(PromoInvalidError);
  });

  it('url-encodes a code with unsafe characters instead of building a broken URL', async () => {
    await expect(api.validatePromo('50% OFF')).rejects.toBeInstanceOf(PromoInvalidError);
  });
});

describe('createOrder', () => {
  it('posts the draft and returns the order', async () => {
    const order = await api.createOrder(draft);

    expect(order).toMatchObject({ reference: 'BRW-1001', totalCents: 2179 });
  });

  it('raises CardDeclinedError with the processor message on a 402', async () => {
    const declined = { ...draft, card: { ...draft.card, number: '4000 0000 0000 0002' } };

    await expect(api.createOrder(declined)).rejects.toMatchObject({
      name: 'CardDeclinedError',
      message: 'Your card was declined. Try a different card.',
    });
    await expect(api.createOrder(declined)).rejects.toBeInstanceOf(CardDeclinedError);
  });

  it('sends the basket as JSON with a content-type the API will accept', async () => {
    const seen: { contentType: string | null; body: unknown } = { contentType: null, body: null };
    server.events.on('request:start', async ({ request }) => {
      if (request.method !== 'POST') return;
      seen.contentType = request.headers.get('content-type');
      seen.body = await request.clone().json();
    });

    await api.createOrder(draft);

    expect(seen.contentType).toBe('application/json');
    expect(seen.body).toMatchObject({ lines: [{ productId: 'ethiopia-guji', qty: 1 }] });
  });
});
