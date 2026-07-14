import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import { logger } from "~/lib/logger";
import { MediaError } from "../errors/media.error";
import type { ProviderNameType } from "../types";
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

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const startedAt = Date.now();

    try {
      const response: AxiosResponse<T> = await scheduleProviderRequest(
        provider,
        () => axios.request<T>({ ...config, timeout: timeoutMs }),
      );

      logger.debug(
        `[media] ${provider} ${operation} ${response.status} (${Date.now() - startedAt}ms, attempt ${attempt + 1})`,
      );

      return response.data;
    } catch (error) {
      lastError = error;
      const status = axios.isAxiosError(error)
        ? (error.response?.status ?? null)
        : null;

      logger.debug(
        `[media] ${provider} ${operation} failed with ${status ?? "network error"} (${Date.now() - startedAt}ms, attempt ${attempt + 1})`,
      );

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

  throw toMediaError(provider, lastError);
}
