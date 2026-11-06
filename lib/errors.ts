export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "PAYLOAD_TOO_LARGE",
  "RATE_LIMITED",
  "MARKET_DATA_UNAVAILABLE",
  "INSUFFICIENT_DATA",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  MARKET_DATA_UNAVAILABLE: 503,
  INSUFFICIENT_DATA: 422,
  INTERNAL_ERROR: 500,
};

/** Errors whose message is safe to show to end users. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { cause?: unknown; retryAfterSeconds?: number },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.status = HTTP_STATUS[code];
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}
