import { logger } from "~/lib/logger";
import type { ProviderNameType } from "../types";

export type MediaOperationType = "search" | "details" | "image" | "create";

export type MediaOperationLogType = {
  provider: ProviderNameType | null;
  operation: MediaOperationType;
  durationMs: number;
  status?: number | null;
  cache?: "hit" | "miss" | null;
  resultCount?: number | null;
  retryCount?: number | null;
  /** A `MediaErrorCodeType`; widened because failures from `allSettled` arrive as plain strings. */
  code?: string | null;
  canonicalKey?: string | null;
};

const FIELD_ORDER = [
  "provider",
  "operation",
  "status",
  "code",
  "cache",
  "results",
  "retries",
  "key",
  "ms",
] as const;

/**
 * The only place media telemetry is formatted, so what may be logged is decided
 * once: scalars we listed, never a request/response body, header, token or user
 * comment. Anything a provider sent back stays out of the log line by
 * construction — callers can only pass these fields.
 */
export function logMediaOperation(entry: MediaOperationLogType): void {
  const values: Record<(typeof FIELD_ORDER)[number], string | number | null> = {
    provider: entry.provider,
    operation: entry.operation,
    status: entry.status ?? null,
    code: entry.code ?? null,
    cache: entry.cache ?? null,
    results: entry.resultCount ?? null,
    retries: entry.retryCount ?? null,
    key: entry.canonicalKey ?? null,
    ms: entry.durationMs,
  };

  const line = `[media] ${FIELD_ORDER.filter((field) => values[field] !== null)
    .map((field) => `${field}=${values[field]}`)
    .join(" ")}`;

  if (entry.code) {
    logger.error(line);
    return;
  }

  logger.debug(line);
}

/** Success line for a create: the canonical key is the one id worth grepping for. */
export function logItemCreated(entry: {
  provider: ProviderNameType;
  canonicalKey: string;
  itemId: string;
  durationMs: number;
}): void {
  logger.info(
    `[media] provider=${entry.provider} operation=create key=${entry.canonicalKey} item=${entry.itemId} ms=${entry.durationMs}`,
  );
}
