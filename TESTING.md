# Testing Brewline

Brewline is a small coffee-ordering app — catalogue, basket with bulk discounts
and promo codes, card checkout, order confirmation. It exists to demonstrate a
layered React Native testing strategy that is worth copying, so every feature in
it was chosen because it is awkward to test at the wrong level.

The rule that drives everything below:

> **Test each behaviour at the cheapest layer that can still fail honestly.**

A pricing rule tested through the UI is slow and tells you little when it breaks.
A deep link tested with Jest tells you nothing at all. Both mistakes are common.

---

## The layers

| Layer                 | Tool                          | Lives in                      | Count   | Runs in |
| --------------------- | ----------------------------- | ----------------------------- | ------- | ------- |
| Static checks         | TypeScript (`strict`), ESLint | whole repo                    | —       | ~15s    |
| Pure logic            | Jest (Node)                   | `src/domain/*.test.ts`        | 59      | ~1s     |
| API boundary          | Jest + **MSW**                | `src/api/http-client.test.ts` | 13      | ~1s     |
| Components            | Jest + **RNTL**               | `src/components/*.test.tsx`   | 5       | ~1s     |
| Screens (integration) | Jest + RNTL                   | `src/screens/*.test.tsx`      | 41      | ~5s     |
| Store shell           | Jest                          | `src/state/*.test.ts`         | 3       | <1s     |
| E2E journeys          | **Maestro** on a real build   | `.maestro/flows/*.yaml`       | 5 flows | ~6 min  |

`npm test` → **121 tests, ~6 seconds.** The Maestro flows are the only thing that
needs a device, and there are deliberately only five of them.

### Two Jest projects, not one

`jest.config.js` defines two projects because the lower layers want different
worlds:

- **`logic`** — plain Node. No React, no native mocks, real `fetch`, real HTTP
  interception by MSW. Fast and boring.
- **`native`** — `jest-expo` preset, React Native Testing Library, the expo-router
  module replaced by a mock.

```bash
npm test                 # both
npm run test:logic       # the fast one — what you leave running while you work
npm run test:native
npm run test:ci          # --ci --coverage, what the workflow runs
```

`test:ci` passes `--forceExit`. `jest-expo` leaves a handle open after the run
that `--detectOpenHandles` cannot attribute to any test (the suite itself is
clean — every query client is torn down in `afterEach`); without the flag CI
hangs for a minute after a green run. Worth re-checking on the next SDK bump.

---

## Layer 1 — pure logic (`src/domain`)

Everything that decides _what a customer pays_ is a pure function with no React,
no network and no clock of its own:

- `money.ts` — integer pence only, `formatMoney` written by hand rather than via
  `Intl` so the output cannot shift with the device locale (Maestro asserts on
  these exact strings).
- `cart.ts` — the basket is an **append-only event log** reduced to state. Merging
  repeat adds, clamping to 20 per line, dropping a line at qty 0, replacing rather
  than stacking promos — all one pure reducer, all trivially testable.
- `pricing.ts` — bulk discounts, promo discounts, the free-delivery threshold, VAT.
- `checkout.ts` — Luhn, expiry, email, and the input formatters.

These tests read as a specification of the business rules:

```ts
it('takes the discount into account before deciding on free delivery', () => {
  // £36 of goods qualifies, but a 20% promo drops it to £28.80 — so delivery
  // is charged again. This is the rule most often got wrong.
});
```

Two design choices make this layer possible:

1. **`now` is injected.** `isExpiryValid(expiry, now)` takes the date as an
   argument, so the "card expired last month" test does not rot with the calendar.
2. **One source of truth for money.** `priceCart()` returns a `Receipt`; the cart
   screen, the checkout screen and the order payload all read from it. No screen
   does its own arithmetic, so no screen can disagree with another.

## Layer 2 — the API boundary (MSW)

`src/api/http-client.test.ts` runs the real HTTP client against MSW, asserting
that each server behaviour becomes a _distinct domain error_ the UI can branch on:

| Server does           | Client raises             | UI does                                        |
| --------------------- | ------------------------- | ---------------------------------------------- |
| 200                   | —                         | renders                                        |
| 401                   | `SessionExpiredError`     | routes to sign-in (no retry button)            |
| 402                   | `CardDeclinedError`       | shows the processor's reason, keeps the basket |
| 404 on `/promos/X`    | `PromoInvalidError`       | shows the code back to the customer            |
| 500                   | `HttpError` (with status) | generic retry                                  |
| connection fails      | `NetworkError`            | generic retry                                  |
| never responds        | `TimeoutError`            | generic retry                                  |
| 200 with an HTML body | `HttpError`               | generic retry                                  |

The last three are the reason this layer exists. A hand-rolled `fetch` stub
resolves instantly and cannot express "the socket hung for nine seconds" or "the
hotel wifi returned a login page with a 200". MSW can.

**It found a real bug while this app was being written.** The client was written
as `fetchImpl = fetch` — a default parameter, which captures the global at
construction time. Every request went to the real network and every test failed as
`NetworkError`. The fix is to resolve `globalThis.fetch` per call. A stub injected
by the test would have hidden that defect completely.

## Layer 3 — components (RNTL)

Only for components with real behaviour of their own. `QuantityStepper` gets tests
because it owns a rule (disable `+` at the maximum); `ProductCard` does not,
because it is covered where it matters — inside the catalogue screen.

Queries go through the accessible name, never the internals:

```ts
await user.press(screen.getByLabelText('Increase quantity of Guji'));
expect(onChange).toHaveBeenCalledWith(4);
```

**No snapshot tests.** A 200-line snapshot breaks on a padding change and is
approved without being read. Explicit assertions on what the customer sees are
worth more and stay honest.

## Layer 4 — screens (the layer that earns its keep)

`src/screens/*.test.tsx` mounts a whole screen inside its real providers —
TanStack Query, the API context, the Zustand store — with only the network faked.
This is where most of the value is, because it is where state, rendering, async
and user interaction meet.

`src/test/render.tsx` gives every screen test:

- `renderScreen(ui, { api })` — a per-test `QueryClient` with `retry: false`, so
  a rejected request surfaces immediately instead of waiting out a backoff.
- `stubApi({ ... })` — a jest-mock `ApiClient`; override only the call under test.
- `deferred<T>()` — a promise you resolve by hand, for asserting on loading and
  in-flight states.

`src/test/setup-native.ts` mocks `expo-router` once, globally: screen tests assert
on the _intent to navigate_ (`expect(mockRouter.push).toHaveBeenCalledWith('/cart')`)
rather than mounting a navigator. It also resets the Zustand singletons before
every test — without that, basket contents leak between tests and you get
order-dependent failures.

What gets tested here is behaviour, never implementation:

- loading → loaded → error → **retry actually refetches**
- a dead session routes to sign-in instead of offering a retry that must fail
- the basket bar appears only once something is in it
- decrementing to 1 → 0 removes the line and shows the empty state
- an invalid promo shows the code back; a failing promo _service_ shows a
  different, generic message
- pressing Pay on an empty form shows five errors **and calls no API**
- the basket is emptied only _after_ the payment succeeds — asserted with a
  deferred promise, mid-flight
- a second press while paying does not double-charge
- a declined card keeps the basket and does not navigate

None of these assert that TanStack Query caches, or that Zustand notifies
subscribers. Testing your libraries is somebody else's job.

## Layer 5 — E2E (Maestro)

Five flows, no more. Each one is here because it covers something the layers
above physically cannot:

| Flow                                 | Why it can only be tested here                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| `01-browse-and-add-to-cart`          | Smoke: the real binary starts, JS bundle loads, the list renders on a device   |
| `02-checkout-happy-path`             | The one journey that takes money, through real text inputs and a real keyboard |
| `03-checkout-validation-and-decline` | Native keyboard + focus behaviour around form errors; recovery after a decline |
| `04-promo-code`                      | Async mutation → re-render → totals, on device                                 |
| `05-deep-link-and-restart`           | Deep links and app backgrounding — pure OS behaviour                           |

The flows assert on `testID`s and on exact money strings, which is why
`formatMoney` is locale-independent. The totals in the flows (`£27.79`, `£25.51`,
`£45.36`) are the same numbers the unit tests derive, so a pricing regression
fails fast in Jest and only _also_ fails in Maestro.

### The E2E build talks to a fake backend

`EXPO_PUBLIC_API_MODE=fake` (set by the `e2e` build profile in `eas.json`) swaps
the entire network layer for `src/api/fake-client.ts` — the same seeded catalogue,
the same promo codes, a card ending `0002` that is always declined. Nothing else
in the app knows.

This is deliberate. An E2E suite pointed at a staging server tests staging's
uptime as much as your app, and it goes red for reasons no one on the team can
fix. Pointed at a deterministic fake, a red run means _the app is broken_.

```bash
# Locally, against a device or emulator with the app installed:
maestro test .maestro
maestro test .maestro/flows/02-checkout-happy-path.yaml
maestro studio          # record a new flow interactively
```

---

## CI: where these tests run

The full pipeline lives in [`CI.md`](./CI.md) — eight EAS Workflows built around
fingerprint-based build reuse. What matters from a testing point of view is _which layer runs
where_:

| Lane            | Trigger         | Test layers it runs                                                        |
| --------------- | --------------- | -------------------------------------------------------------------------- |
| `pr-checks.yml` | every PR push   | static checks, all 121 Jest tests, workflow validation                     |
| `pr-e2e.yml`    | `e2e` label     | the full 5-flow Maestro suite, both platforms                              |
| `main.yml`      | merge to `main` | Jest, then Maestro `smoke` tag only                                        |
| `release.yml`   | tag `v*`        | Maestro `smoke` + `critical` against a **release-signed, minified** binary |
| `nightly.yml`   | 03:00 GMT       | every flow, on an unconditional cold build                                 |

Two things about that split are deliberate.

**The E2E lane is opt-in per PR.** Five flows on two platforms is 5–25 minutes; making that a
tax on every push would train everyone to ignore it. Adding the `e2e` label is the signal
that a change is worth it — native config, a payment path, navigation.

**Maestro tag filters carry real meaning.** `smoke` is "does the app start and can it take
money"; `critical` is the full set of journeys that must never break. `main.yml` runs only
`smoke` because it fires on every merge; `release.yml` runs both because the cost of missing
something there is a store review cycle.

The E2E build always talks to the in-memory fake (`EXPO_PUBLIC_API_MODE=fake`), including on
the release lane via the `production-e2e` profile. A red Maestro run means the app is broken,
never that staging is down.

---

## Coverage, read honestly

`npm run test:ci` reports **~91% of statements**, but the number matters less than
_where the gaps are_:

| Area                     | Coverage | Why                                                                                 |
| ------------------------ | -------- | ----------------------------------------------------------------------------------- |
| `src/domain`             | ~98%     | This is the part that must not be wrong. Anything uncovered here is a missing rule. |
| `src/screens`            | ~96%     | Every state a customer can reach.                                                   |
| `src/api/http-client.ts` | ~97%     | Every status code in the table above.                                               |
| `src/api/fake-client.ts` | ~18%     | **By design** — it is exercised by Maestro on a device, not by Jest.                |
| `src/api/provider.tsx`   | ~56%     | Wiring. Covered by the app starting at all.                                         |

Chasing the last 9% would mean writing tests for the fake backend and for
provider plumbing — cost with no signal. Coverage is a map of what is untested,
not a target to hit.

---

## Adding a test — which layer?

```
Is it a rule about values? (prices, validation, state transitions)
  → src/domain, pure function, Jest.

Is it about how the app reacts to the server?
  → src/api with MSW. Add the status code to the table above.

Is it about what a customer sees or does on one screen?
  → src/screens with RNTL. Query by label/role/text, assert on behaviour.

Is it about the device — launch, deep links, keyboard, permissions,
backgrounding, the release binary?
  → .maestro. And think hard: five flows is the budget, not the floor.

Otherwise: it probably belongs one layer lower than you think.
```

## Deliberate omissions

- **No snapshot tests.** See above.
- **No tests for third-party libraries.** No test asserts that Zustand notifies or
  that TanStack Query caches.
- **No Detox.** Detox offers deeper RN synchronisation and would be the right call
  for a heavily-animated app, but it costs meaningful native config and
  maintenance. Maestro's YAML flows and its first-class EAS job are the better
  trade for a suite this size.
- **No production monitoring wired up.** In a real app, Sentry belongs here as the
  final layer — the tests tell you about the code you predicted, crash reporting
  tells you about the code you did not.
