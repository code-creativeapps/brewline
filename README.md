# Brewline

A small Expo / React Native coffee shop, built as a working reference for a
**layered testing strategy** and a **ready-to-run EAS Workflows pipeline** with
Maestro E2E.

**→ The point of this repo is [`TESTING.md`](./TESTING.md) and [`CI.md`](./CI.md).**

## The app

Catalogue → basket (bulk discounts, promo codes, free-delivery threshold) →
card checkout (client-side validation, declines, in-flight protection) → order
confirmation reachable by deep link.

Small enough to read in one sitting; complicated enough that testing it at the
wrong layer hurts.

## Stack

|                                                   |                                        |
| ------------------------------------------------- | -------------------------------------- |
| Expo SDK 57, expo-router, TypeScript (strict)     | app                                    |
| TanStack Query                                    | server state, loading/error/retry      |
| Zustand over an append-only event log             | basket state                           |
| Jest + jest-expo, React Native Testing Library 14 | unit / component / screen              |
| MSW                                               | the API boundary                       |
| Maestro                                           | 5 critical E2E journeys                |
| EAS Workflows                                     | CI: fast gate, E2E gate, release smoke |

## Run it

```bash
npm install
EXPO_PUBLIC_API_MODE=fake npx expo start   # no backend needed
```

`EXPO_PUBLIC_API_MODE=fake` swaps the network layer for an in-memory backend
(`src/api/fake-client.ts`). Promo codes `BREW10`, `FIVEOFF`, `FREESHIP`; any card
ending `0002` is declined; `4242 4242 4242 4242` succeeds.

## Check it

```bash
npm test                    # 121 tests, ~6s
npm run typecheck
npm run lint
npm run validate:workflows  # structural check on .eas/workflows/*.yml
maestro test .maestro       # needs a device/emulator with the app installed
```

## Layout

```
app/                    expo-router routes — thin, they re-export screens
src/
  domain/               pure business logic + its tests (no React, no network)
  api/                  typed client, typed errors, in-memory fake
  screens/              screens + their integration tests
  components/           reusable UI
  state/                zustand stores over the domain reducers
  test/                 render helpers, API stubs, MSW server, jest setup
.maestro/flows/         5 E2E journeys
.eas/workflows/         8 CI workflows — see CI.md
.eas/functions/setup/   shared checkout + cache + install
scripts/                offline workflow validator
```

## Before this runs on EAS

The project id in `app.json` is a placeholder. One command:

```bash
npx eas-cli init                              # links the repo to an EAS project
npx eas-cli workflow:validate .eas/workflows/pr-e2e.yml
npx eas-cli workflow:run .eas/workflows/pr-checks.yml
```

Until then `npm run validate:workflows` covers structure, job references and file size
offline. The PR triggers additionally need the repo on GitHub with Expo's GitHub App
installed; `eas workflow:run` works without either.
