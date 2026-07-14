/**
 * Retry policy shared by every provider client.
 *
 * Only transient statuses are retried. A 400/401/403/404 is a permanent answer:
 * retrying it burns rate-limit budget and delays the error the caller needs.
 */

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

export const DEFAULT_MAX_RETRIES = 2;

export const isRetryableStatus = (status: number | null | undefined): boolean =>
  status != null && RETRYABLE_STATUSES.has(status);

/**
 * Delay before the next attempt. `Retry-After` wins when the provider sends it
 * (seconds, or an HTTP date); otherwise exponential backoff with jitter.
 */
export function getRetryDelayMs(props: {
  attempt: number;
  retryAfterHeader?: string | null;
  baseDelayMs?: number;
  maxDelayMs?: number;
  now?: number;
}): number {
  const {
    attempt,
    retryAfterHeader,
    baseDelayMs = 500,
    maxDelayMs = 10_000,
    now = Date.now(),
  } = props;

  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);

    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, maxDelayMs);
    }

    const dateMs = Date.parse(retryAfterHeader);

    if (!Number.isNaN(dateMs)) {
      return Math.min(Math.max(dateMs - now, 0), maxDelayMs);
    }
  }

  const backoff = baseDelayMs * 2 ** attempt;

  return Math.min(backoff, maxDelayMs);
}

export const PROVIDER_TIMEOUTS_MS = {
  search: 8_000,
  details: 15_000,
  image: 15_000,
  /** Hardcover hard-times-out at 30s; stay below it. */
  hardcover: 25_000,
} as const;
