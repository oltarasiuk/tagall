import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import { MediaError } from "../errors/media.error";
import type { ProviderNameType } from "../types";
import { logMediaOperation } from "./media-telemetry.service";
import { scheduleProviderRequest } from "./provider-limiter.service";
import {
  DEFAULT_MAX_RETRIES,
  getRetryDelayMs,
  isRetryableStatus,
} from "../utils/retry.util";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type ProviderRequestOptionsType = {
  provider: ProviderNameType;
  operation: "search" | "details" | "image";
  timeoutMs: number;
  maxRetries?: number;
};

const toErrorCode = (error: unknown): string =>
  error instanceof MediaError ? error.code : "PROVIDER_BAD_RESPONSE";

function toMediaError(
  provider: ProviderNameType,
  error: unknown,
): MediaError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;

    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return new MediaError("PROVIDER_TIMEOUT", `${provider} timed out`, {
        provider,
        cause: error,
      });
    }
    if (status === 401 || status === 403) {
      return new MediaError(
        "PROVIDER_AUTH_FAILED",
        `${provider} rejected the credentials`,
        { provider, cause: error },
      );
    }
    if (status === 429) {
      return new MediaError(
        "PROVIDER_RATE_LIMITED",
        `${provider} rate limit exceeded`,
        { provider, cause: error },
      );
    }
  }

  return new MediaError(
    "PROVIDER_BAD_RESPONSE",
    `${provider} returned an unusable response`,
    { provider, cause: error },
  );
}

/**
 * Every provider call goes through here: per-provider queue, timeout, bounded
 * retry on transient statuses only, and errors mapped to typed MediaErrors.
 *
 * Nothing from the request or response is logged beyond status and timing —
 * headers carry tokens.
 */
export async function providerRequest<T>(
  options: ProviderRequestOptionsType,
  config: AxiosRequestConfig,
): Promise<T> {
  const { provider, operation, timeoutMs, maxRetries = DEFAULT_MAX_RETRIES } =
    options;

  let lastError: unknown;
  let attempts = 0;
  const requestStartedAt = Date.now();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const startedAt = Date.now();
    attempts = attempt;

    try {
      const response: AxiosResponse<T> = await scheduleProviderRequest(
        provider,
        () => axios.request<T>({ ...config, timeout: timeoutMs }),
      );

      logMediaOperation({
        provider,
        operation,
        status: response.status,
        retryCount: attempt,
        durationMs: Date.now() - startedAt,
      });

      return response.data;
    } catch (error) {
      lastError = error;
      const status = axios.isAxiosError(error)
        ? (error.response?.status ?? null)
        : null;

      if (attempt === maxRetries || !isRetryableStatus(status)) {
        break;
      }

      const retryAfter = axios.isAxiosError(error)
        ? ((error.response?.headers?.["retry-after"] as string | undefined) ??
          null)
        : null;

      await sleep(getRetryDelayMs({ attempt, retryAfterHeader: retryAfter }));
    }
  }

  const mediaError = toMediaError(provider, lastError);

  logMediaOperation({
    provider,
    operation,
    status: axios.isAxiosError(lastError)
      ? (lastError.response?.status ?? null)
      : null,
    code: toErrorCode(mediaError),
    retryCount: attempts,
    durationMs: Date.now() - requestStartedAt,
  });

  throw mediaError;
}
