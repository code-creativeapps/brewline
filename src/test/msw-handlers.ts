import { http, HttpResponse, delay } from 'msw';

import { SEED_CATALOG, SEED_PROMOS } from '../api/fake-client';

export const TEST_API_URL = 'https://api.test.brewline/v1';

/**
 * The happy path. Individual tests override a single route with
 * `server.use(...)` to exercise 500s, 401s, timeouts and declines.
 */
export const handlers = [
  http.get(`${TEST_API_URL}/products`, () => HttpResponse.json(SEED_CATALOG)),

  http.get(`${TEST_API_URL}/promos/:code`, ({ params }) => {
    const promo = SEED_PROMOS[String(params.code).toUpperCase()];
    if (!promo) {
      return HttpResponse.json({ code: 'promo_not_found' }, { status: 404 });
    }
    return HttpResponse.json(promo);
  }),

  http.post(`${TEST_API_URL}/orders`, async ({ request }) => {
    const draft = (await request.json()) as {
      card: { number: string };
      totalCents: number;
      email: string;
    };
    if (draft.card.number.replace(/\D/g, '').endsWith('0002')) {
      return HttpResponse.json(
        { code: 'card_declined', message: 'Your card was declined. Try a different card.' },
        { status: 402 },
      );
    }
    return HttpResponse.json({
      id: 'ord_1',
      reference: 'BRW-1001',
      totalCents: draft.totalCents,
      email: draft.email,
      etaDays: 3,
    });
  }),
];

/** Helpers used by the error-path tests, so intent reads at the call site. */
export const failWith = (path: string, status: number, body: Record<string, unknown> = {}) =>
  http.all(`${TEST_API_URL}${path}`, () => HttpResponse.json(body, { status }));

export const networkErrorOn = (path: string) =>
  http.all(`${TEST_API_URL}${path}`, () => HttpResponse.error());

export const hangFor = (path: string, ms: number) =>
  http.all(`${TEST_API_URL}${path}`, async () => {
    await delay(ms);
    return HttpResponse.json({});
  });

export const malformedJsonOn = (path: string) =>
  http.all(`${TEST_API_URL}${path}`, () =>
    HttpResponse.text('<html>gateway</html>', { headers: { 'content-type': 'application/json' } }),
  );
