import { server } from './msw-server';

beforeAll(() => {
  // Any request the handlers don't recognise is a bug in the test, not a
  // silent pass-through to the internet.
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => server.resetHandlers());
afterAll(() => server.close());
