/** One error type per thing the UI has to react to differently. */
export class ApiError extends Error {}

export class NetworkError extends ApiError {
  constructor() {
    super('Network request failed');
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends ApiError {
  constructor(public readonly timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

export class HttpError extends ApiError {
  constructor(
    public readonly status: number,
    message = `Request failed (${status})`,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** 401 — the UI must send the customer back to sign-in, not show a retry button. */
export class SessionExpiredError extends ApiError {
  constructor() {
    super('Your session has expired');
    this.name = 'SessionExpiredError';
  }
}

export class PromoInvalidError extends ApiError {
  constructor(public readonly code: string) {
    super(`“${code}” is not a valid code`);
    this.name = 'PromoInvalidError';
  }
}

/** 402 — the payment was understood and refused. Retrying the same card is pointless. */
export class CardDeclinedError extends ApiError {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = 'CardDeclinedError';
  }
}
