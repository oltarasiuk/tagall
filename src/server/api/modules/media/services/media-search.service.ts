import { logger } from "~/lib/logger";
import { isMediaError } from "../errors/media.error";
import { providerRegistry, type ProviderRegistryType } from "../providers";
import type {
  MediaKindType,
  ProviderNameType,
  ProviderSearchResultType,
} from "../types";

export type MediaSearchInputType = {
  query: string;
  limit: number;
  /** Omitted = search every enabled provider ("all" tab). */
  mediaKind?: MediaKindType;
  registry?: ProviderRegistryType;
};

export type ProviderErrorType = {
  provider: ProviderNameType;
  code: string;
  message: string;
};

export type MediaSearchOutputType = {
  results: ProviderSearchResultType[];
  providerErrors: ProviderErrorType[];
};

/**
 * Fans out to every provider that can answer, with `allSettled`: one broken
 * key or one provider outage degrades the result set, it never fails the
 * search. Deduplication and scoring happen downstream.
 */
export async function searchMedia(
  input: MediaSearchInputType,
): Promise<MediaSearchOutputType> {
  const { query, limit, mediaKind, registry = providerRegistry } = input;

  const adapters = mediaKind
    ? registry.getEnabledForKind(mediaKind)
    : registry.getEnabled();

  if (adapters.length === 0) {
    logger.debug(
      `[media] No enabled provider for ${mediaKind ?? "any media kind"}`,
    );
    return { results: [], providerErrors: [] };
  }

  // In the "all" tab each provider only contributes a slice, so one chatty
  // source cannot fill the page on its own.
  const perProviderLimit = Math.min(
    30,
    Math.max(
      limit * 2,
      mediaKind ? 10 : Math.ceil((limit * 2) / adapters.length),
    ),
  );

  const settled = await Promise.allSettled(
    adapters.map((adapter) =>
      adapter.search({ query, limit: perProviderLimit, mediaKind }),
    ),
  );

  const results: ProviderSearchResultType[] = [];
  const providerErrors: ProviderErrorType[] = [];

  settled.forEach((outcome, index) => {
    const adapter = adapters[index]!;

    if (outcome.status === "fulfilled") {
      results.push(...outcome.value);
      return;
    }

    const error: unknown = outcome.reason;
    const code = isMediaError(error) ? error.code : "PROVIDER_BAD_RESPONSE";
    const message = error instanceof Error ? error.message : String(error);

    logger.error(`[media] ${adapter.name} search failed: ${code}`, message);
    providerErrors.push({ provider: adapter.name, code, message });
  });

  return { results, providerErrors };
}
