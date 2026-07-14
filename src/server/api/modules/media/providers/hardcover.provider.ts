import { env } from "~/env";
import { MediaError } from "../errors/media.error";
import {
  HardcoverBookResponseSchema,
  HardcoverBookSchema,
  HardcoverSearchDocumentSchema,
  HardcoverSearchResponseSchema,
  tagsOf,
  type HardcoverBookType,
  type HardcoverSearchDocumentType,
} from "../schemas/hardcover.schema";
import { providerRequest } from "../services/provider-http.service";
import type {
  ImageCandidateType,
  MediaProviderAdapterType,
  NormalizedItemDetailsType,
  ProviderSearchInputType,
  ProviderSearchResultType,
} from "../types";
import { classifyBookKind } from "../utils/classify-book-kind.util";
import {
  isWantedBookResult,
  matchesBookTitle,
} from "../utils/filter-book-results.util";
import { normalizeRating } from "../utils/normalize-rating.util";

/**
 * Hardcover is the second book source and the enrichment one: it carries the
 * descriptions, series positions and genres Open Library usually lacks, while
 * Open Library keeps the identity (a work id, not an edition).
 *
 * Backend-only by their terms — the token acts on behalf of an account and must
 * never reach the browser.
 */

const HARDCOVER_GRAPHQL_URL = "https://api.hardcover.app/v1/graphql";
const HARDCOVER_BOOK_URL = "https://hardcover.app/books";

const SEARCH_TIMEOUT_MS = 8_000;
// Hardcover hard-times-out at 30s; stay under it so our error is the typed one.
const DETAILS_TIMEOUT_MS = 25_000;

const MAX_GENRES = 10;
const MAX_KEYWORDS = 20;

const SEARCH_QUERY = `
  query TagAllSearch($query: String!, $perPage: Int!) {
    search(query: $query, query_type: "Book", per_page: $perPage, page: 1) {
      results
    }
  }
`;

const BOOK_QUERY = `
  query TagAllBook($id: Int!) {
    books(where: { id: { _eq: $id } }, limit: 1) {
      id
      slug
      title
      subtitle
      description
      release_year
      rating
      ratings_count
      compilation
      image { url }
      contributions { author { name } }
      book_series { position series { name } }
      cached_tags
    }
  }
`;

const isEnabled = (): boolean => Boolean(env.HARDCOVER_API_TOKEN);

/**
 * The token is stored with its "Bearer " prefix already in place, exactly as
 * Hardcover hands it out. Adding a second one would produce "Bearer Bearer ...".
 */
const headers = () => ({
  authorization: env.HARDCOVER_API_TOKEN ?? "",
  "content-type": "application/json",
});

const request = async <T>(
  operation: "search" | "details",
  query: string,
  variables: Record<string, unknown>,
): Promise<T> => {
  if (!isEnabled()) {
    throw new MediaError(
      "PROVIDER_DISABLED",
      "Hardcover is not configured (HARDCOVER_API_TOKEN)",
      { provider: "hardcover" },
    );
  }

  return providerRequest<T>(
    {
      provider: "hardcover",
      operation,
      timeoutMs: operation === "search" ? SEARCH_TIMEOUT_MS : DETAILS_TIMEOUT_MS,
    },
    {
      url: HARDCOVER_GRAPHQL_URL,
      method: "POST",
      headers: headers(),
      data: { query, variables },
    },
  );
};

const bookUrl = (id: string, slug: string | null | undefined): string =>
  `${HARDCOVER_BOOK_URL}/${slug ?? id}`;

/**
 * Hardcover cover art is sourced from third parties, so it is offered for
 * display but never persisted: our own copy of it is not ours to make. Open
 * Library's covers are the ones the poster pipeline stores.
 */
const toImageCandidates = (
  url: string | null | undefined,
): ImageCandidateType[] =>
  url
    ? [
        {
          source: "hardcover",
          url,
          width: null,
          height: null,
          language: null,
          likes: null,
          kind: "cover",
          canPersist: false,
        },
      ]
    : [];

const toRating = (book: {
  rating?: number | null;
  ratings_count?: number | null;
}) =>
  normalizeRating({
    source: "hardcover",
    value: book.rating ?? null,
    scale: 5,
    votes: book.ratings_count ?? null,
  });

const toSearchResult = (
  document: HardcoverSearchDocumentType,
  index: number,
): ProviderSearchResultType | null => {
  const id = String(document.id).trim();
  const title = document.title?.trim();

  if (!id || !title) {
    return null;
  }

  const url = bookUrl(id, document.slug);
  const genres = (document.genres ?? []).slice(0, MAX_GENRES);
  const keywords = [...(document.tags ?? []), ...(document.moods ?? [])].slice(
    0,
    MAX_KEYWORDS,
  );

  return {
    provider: "hardcover",
    externalId: id,
    mediaKind: classifyBookKind([...genres, ...keywords]),
    title,
    originalTitle: null,
    originalLanguage: null,
    year: document.release_year ?? null,
    description: document.description?.trim() ?? null,
    authorsOrCreators: document.author_names ?? [],
    seriesName: document.series_names?.[0] ?? null,
    seriesPosition: null,
    identifiers: [{ provider: "hardcover", externalId: id, url }],
    isbns: document.isbns ?? [],
    imageCandidates: toImageCandidates(document.image?.url),
    rating: toRating(document),
    genres,
    keywords,
    relevanceRank: index,
    sourceUrl: url,
  };
};

const toDetails = (book: HardcoverBookType): NormalizedItemDetailsType => {
  const id = String(book.id).trim();
  const url = bookUrl(id, book.slug);
  const series = book.book_series?.[0];

  const people = (book.contributions ?? [])
    .map((contribution) => contribution.author?.name?.trim())
    .filter((name): name is string => !!name);

  const genres = tagsOf(book.cached_tags, "Genre").slice(0, MAX_GENRES);
  const keywords = tagsOf(book.cached_tags, "Tag").slice(0, MAX_KEYWORDS);

  return {
    mediaKind: classifyBookKind([...genres, ...keywords]),
    title: book.title.trim(),
    originalTitle: null,
    originalLanguage: null,
    year: book.release_year ?? null,
    description: book.description?.trim() ?? null,
    sourceUrl: url,
    identifiers: [{ provider: "hardcover", externalId: id, url }],
    imageCandidates: toImageCandidates(book.image?.url),
    rating: toRating(book),
    fields: {
      genres,
      keywords,
      people,
      series: series?.series?.name ?? null,
    },
  };
};

export const hardcoverProvider: MediaProviderAdapterType = {
  name: "hardcover",
  supportedKinds: ["book", "comic"],

  get enabled() {
    return isEnabled();
  },

  async search(
    input: ProviderSearchInputType,
  ): Promise<ProviderSearchResultType[]> {
    const data = await request<unknown>("search", SEARCH_QUERY, {
      query: input.query,
      perPage: input.limit,
    });

    const parsed = HardcoverSearchResponseSchema.parse(data);
    const hits = parsed.data?.search?.results?.hits ?? [];

    return hits.flatMap((hit, index) => {
      const document = (hit as { document?: unknown })?.document;
      const result = HardcoverSearchDocumentSchema.safeParse(document);

      if (!result.success) {
        return [];
      }

      const searchResult = toSearchResult(result.data, index);

      return searchResult &&
        matchesBookTitle(searchResult, input.query) &&
        isWantedBookResult(searchResult, input.mediaKind)
        ? [searchResult]
        : [];
    });
  },

  async getDetails(externalId: string): Promise<NormalizedItemDetailsType> {
    const id = Number(externalId.trim());

    if (!Number.isInteger(id) || id <= 0) {
      throw new MediaError(
        "ITEM_NOT_FOUND",
        `"${externalId}" is not a Hardcover book id`,
        { provider: "hardcover" },
      );
    }

    const data = await request<unknown>("details", BOOK_QUERY, { id });
    const books = HardcoverBookResponseSchema.parse(data).data?.books ?? [];
    const parsed = HardcoverBookSchema.safeParse(books[0]);

    if (!parsed.success) {
      throw new MediaError(
        "ITEM_NOT_FOUND",
        `Hardcover has no usable book ${id}`,
        { provider: "hardcover", cause: parsed.error },
      );
    }

    return toDetails(parsed.data);
  },
};
