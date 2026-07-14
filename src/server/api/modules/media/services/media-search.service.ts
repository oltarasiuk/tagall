import { logger } from "~/lib/logger";
import { isMediaError } from "../errors/media.error";
import { providerRegistry, type ProviderRegistryType } from "../providers";
import { logMediaOperation } from "./media-telemetry.service";
import { getMediaDetails } from "./media-details.service";
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

const parseDirectReference = (
  value: string,
): { provider: ProviderNameType; externalId: string } | null => {
  const input = value.trim();
  const openLibrary = /(?:openlibrary:|openlibrary\.org\/works\/)(OL\d+W)\/?$/i.exec(input);
  if (openLibrary) return { provider: "openlibrary", externalId: openLibrary[1]! };
  const hardcover = /^(?:hardcover:)?(\d+)$/i.exec(input);
  // A bare numeric id is only safely routable when explicitly prefixed.
  if (input.toLowerCase().startsWith("hardcover:") && hardcover)
    return { provider: "hardcover", externalId: hardcover[1]! };
  const vndb = /(?:vndb:|vndb\.org\/)(v\d+)\/?$/i.exec(input);
  if (vndb) return { provider: "vndb", externalId: vndb[1]! };
  return null;
};

const toDirectResult = (
  provider: ProviderNameType,
  externalId: string,
  details: Awaited<ReturnType<typeof getMediaDetails>>,
): ProviderSearchResultType => {
  const people = details.fields.people;
  return {
    provider,
    externalId,
    mediaKind: details.mediaKind,
    title: details.title,
    originalTitle: details.originalTitle,
    alternateTitles: [],
    originalLanguage: details.originalLanguage,
    year: details.year,
    description: details.description,
    authorsOrCreators: Array.isArray(people)
      ? people.filter((person): person is string => typeof person === "string")
      : typeof people === "string"
        ? [people]
        : [],
    seriesName: typeof details.fields.series === "string" ? details.fields.series : null,
    seriesPosition: null,
    identifiers: details.identifiers,
    isbns: [],
    imageCandidates: details.imageCandidates,
    rating: details.rating,
    popularity: details.rating?.votes
      ? { source: provider, value: details.rating.votes, kind: "votes" }
      : null,
    genres: Array.isArray(details.fields.genres)
      ? details.fields.genres.filter((value): value is string => typeof value === "string")
      : [],
    keywords: Array.isArray(details.fields.keywords)
      ? details.fields.keywords.filter((value): value is string => typeof value === "string")
      : [],
    relevanceRank: 0,
    sourceUrl: details.sourceUrl,
  };
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

  const directReference = parseDirectReference(query);
  if (directReference) {
    try {
      const details = await getMediaDetails({ ...directReference, registry });
      const result = toDirectResult(
        directReference.provider,
        directReference.externalId,
        details,
      );
      return !mediaKind || result.mediaKind === mediaKind
        ? { results: [result], providerErrors: [] }
        : { results: [], providerErrors: [] };
    } catch (error) {
      const code = isMediaError(error) ? error.code : "PROVIDER_BAD_RESPONSE";
      return {
        results: [],
        providerErrors: [{
          provider: directReference.provider,
          code,
          message: error instanceof Error ? error.message : String(error),
        }],
      };
    }
  }

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

  const startedAt = Date.now();

  const settled = await Promise.allSettled(
    adapters.map((adapter) =>
      adapter.search({ query, limit: perProviderLimit, mediaKind }),
    ),
  );

  const results: ProviderSearchResultType[] = [];
  const providerErrors: ProviderErrorType[] = [];

  settled.forEach((outcome, index) => {
    const adapter = adapters[index]!;
    const durationMs = Date.now() - startedAt;

    if (outcome.status === "fulfilled") {
      logMediaOperation({
        provider: adapter.name,
        operation: "search",
        resultCount: outcome.value.length,
        durationMs,
      });
      results.push(...outcome.value);
      return;
    }

    const error: unknown = outcome.reason;
    const code = isMediaError(error) ? error.code : "PROVIDER_BAD_RESPONSE";
    const message = error instanceof Error ? error.message : String(error);

    logMediaOperation({
      provider: adapter.name,
      operation: "search",
      code,
      durationMs,
    });
    providerErrors.push({ provider: adapter.name, code, message });
  });

  return { results, providerErrors };
}
