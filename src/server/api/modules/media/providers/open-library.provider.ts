import { env } from "~/env";
import { MediaError } from "../errors/media.error";
import {
  OpenLibraryAuthorSchema,
  OpenLibraryRatingsSchema,
  OpenLibrarySearchDocSchema,
  OpenLibrarySearchResponseSchema,
  OpenLibraryWorkSchema,
  toPlainText,
  type OpenLibrarySearchDocType,
} from "../schemas/open-library.schema";
import { providerRequest } from "../services/provider-http.service";
import type {
  ExternalIdentifierValueType,
  ImageCandidateType,
  MediaProviderAdapterType,
  NormalizedItemDetailsType,
  ProviderSearchInputType,
  ProviderSearchResultType,
} from "../types";
import { classifyBookKind } from "../utils/classify-book-kind.util";
import { isWantedBookResult } from "../utils/filter-book-results.util";
import { normalizeRating } from "../utils/normalize-rating.util";

/**
 * Books are works, not editions: "Dune" is one item, not the 40 printings of
 * it. Open Library models that distinction natively (`/works/OL893415W`), which
 * is why it is the primary book source. Edition keys and ISBNs are kept only as
 * secondary identifiers, for deduplication against ISBN-based providers.
 */

const OPEN_LIBRARY_URL = "https://openlibrary.org";
const OPEN_LIBRARY_COVERS_URL = "https://covers.openlibrary.org";

const SEARCH_TIMEOUT_MS = 8_000;
const DETAILS_TIMEOUT_MS = 15_000;

const MAX_GENRES = 10;
const MAX_KEYWORDS = 20;
const MAX_DETAIL_AUTHORS = 3;

const SEARCH_FIELDS = [
  "key",
  "title",
  "author_name",
  "author_key",
  "first_publish_year",
  "cover_i",
  "isbn",
  "subject",
  "ratings_average",
  "ratings_count",
  "language",
  "publisher",
].join(",");

/**
 * Open Library grants 3 rps to clients that identify themselves and 1 rps to
 * anonymous ones, so the contact email is worth sending even though no key is
 * required.
 */
const userAgent = (): string => {
  const contact = env.OPEN_LIBRARY_CONTACT_EMAIL;

  return contact ? `TagAll/1.0 (${contact})` : "TagAll/1.0";
};

const headers = () => ({ "User-Agent": userAgent(), Accept: "application/json" });

/** "/works/OL893415W" -> "OL893415W". The case is part of the id and is kept. */
export const toWorkId = (key: string): string | null => {
  const id = key.trim().replace(/^\/works\//, "").replace(/\/$/, "");

  return /^OL\d+W$/i.test(id) ? id : null;
};

export const workUrl = (workId: string): string =>
  `${OPEN_LIBRARY_URL}/works/${workId}`;

/**
 * `default=false` makes the covers service 404 instead of serving its grey
 * placeholder, so a missing cover fails the download rather than persisting a
 * picture of nothing.
 */
export const coverUrl = (coverId: number): string =>
  `${OPEN_LIBRARY_COVERS_URL}/b/id/${coverId}-L.jpg?default=false`;

const toImageCandidates = (
  coverId: number | null | undefined,
): ImageCandidateType[] =>
  coverId
    ? [
        {
          source: "openlibrary",
          url: coverUrl(coverId),
          width: null,
          height: null,
          language: null,
          likes: null,
          kind: "cover",
          canPersist: true,
        },
      ]
    : [];

/**
 * Subjects are a free-form crowd-sourced pile: "Fiction", "New York Times
 * bestseller", "nyt:hardcover-fiction=2011-05-01". Long or machine-generated
 * entries are dropped, the first few become genres and the rest keywords.
 */
export const cleanSubjects = (
  subjects: string[] | null | undefined,
): { genres: string[]; keywords: string[] } => {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const subject of subjects ?? []) {
    const value = subject.trim();

    if (!value || value.length > 40 || value.includes("=") || value.includes(":")) {
      continue;
    }

    const key = value.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    cleaned.push(value);
  }

  return {
    genres: cleaned.slice(0, MAX_GENRES),
    keywords: cleaned.slice(MAX_GENRES, MAX_GENRES + MAX_KEYWORDS),
  };
};

const toIdentifiers = (workId: string): ExternalIdentifierValueType[] => [
  {
    provider: "openlibrary",
    externalId: workId,
    url: workUrl(workId),
  },
];

const toRating = (doc: {
  ratings_average?: number | null;
  ratings_count?: number | null;
}) =>
  normalizeRating({
    source: "openlibrary",
    value: doc.ratings_average ?? null,
    scale: 5,
    votes: doc.ratings_count ?? null,
  });

/** "June 1965" / "1965-06-01" / "1965" all carry the same useful part. */
export const parseYear = (value: string | null | undefined): number | null => {
  const match = value?.match(/\d{4}/);

  if (!match) {
    return null;
  }

  const year = Number(match[0]);

  return year >= 1000 && year <= 2999 ? year : null;
};

const toSearchResult = (
  doc: OpenLibrarySearchDocType,
  index: number,
): ProviderSearchResultType | null => {
  const workId = toWorkId(doc.key);
  const title = doc.title?.trim();

  if (!workId || !title) {
    return null;
  }

  const { genres, keywords } = cleanSubjects(doc.subject);

  return {
    provider: "openlibrary",
    externalId: workId,
    mediaKind: classifyBookKind(doc.subject ?? []),
    title,
    originalTitle: null,
    originalLanguage: doc.language?.[0] ?? null,
    year: doc.first_publish_year ?? null,
    description: null,
    authorsOrCreators: doc.author_name ?? [],
    seriesName: null,
    seriesPosition: null,
    identifiers: toIdentifiers(workId),
    isbns: doc.isbn ?? [],
    imageCandidates: toImageCandidates(doc.cover_i),
    rating: toRating(doc),
    genres,
    keywords,
    relevanceRank: index,
    sourceUrl: workUrl(workId),
  };
};

const fetchAuthorNames = async (
  work: { authors?: { author?: { key: string } | null }[] | null },
): Promise<string[]> => {
  const keys = (work.authors ?? [])
    .map((entry) => entry.author?.key)
    .filter((key): key is string => !!key)
    .slice(0, MAX_DETAIL_AUTHORS);

  const names = await Promise.all(
    keys.map(async (key) => {
      try {
        const data = await providerRequest<unknown>(
          {
            provider: "openlibrary",
            operation: "details",
            timeoutMs: DETAILS_TIMEOUT_MS,
          },
          { url: `${OPEN_LIBRARY_URL}${key}.json`, headers: headers() },
        );

        return OpenLibraryAuthorSchema.parse(data).name ?? null;
      } catch {
        // An author page that will not load is not a reason to lose the book.
        return null;
      }
    }),
  );

  return names.filter((name): name is string => !!name);
};

const fetchRating = async (workId: string) => {
  try {
    const data = await providerRequest<unknown>(
      {
        provider: "openlibrary",
        operation: "details",
        timeoutMs: DETAILS_TIMEOUT_MS,
      },
      {
        url: `${OPEN_LIBRARY_URL}/works/${workId}/ratings.json`,
        headers: headers(),
      },
    );

    const summary = OpenLibraryRatingsSchema.parse(data).summary;

    return normalizeRating({
      source: "openlibrary",
      value: summary?.average ?? null,
      scale: 5,
      votes: summary?.count ?? null,
    });
  } catch {
    return null;
  }
};

export const openLibraryProvider: MediaProviderAdapterType = {
  name: "openlibrary",
  supportedKinds: ["book", "comic"],
  // Open, key-less API: available as long as the network is.
  enabled: true,

  async search(
    input: ProviderSearchInputType,
  ): Promise<ProviderSearchResultType[]> {
    const data = await providerRequest<unknown>(
      {
        provider: "openlibrary",
        operation: "search",
        timeoutMs: SEARCH_TIMEOUT_MS,
      },
      {
        url: `${OPEN_LIBRARY_URL}/search.json`,
        headers: headers(),
        params: {
          q: input.query,
          limit: input.limit,
          language: "eng",
          fields: SEARCH_FIELDS,
        },
      },
    );

    const { docs } = OpenLibrarySearchResponseSchema.parse(data);

    return docs.flatMap((doc, index) => {
      const parsed = OpenLibrarySearchDocSchema.safeParse(doc);

      if (!parsed.success) {
        return [];
      }

      const result = toSearchResult(parsed.data, index);

      return result && isWantedBookResult(result, input.mediaKind)
        ? [result]
        : [];
    });
  },

  async getDetails(externalId: string): Promise<NormalizedItemDetailsType> {
    const workId = toWorkId(externalId);

    if (!workId) {
      throw new MediaError(
        "ITEM_NOT_FOUND",
        `"${externalId}" is not an Open Library work id`,
        { provider: "openlibrary" },
      );
    }

    const data = await providerRequest<unknown>(
      {
        provider: "openlibrary",
        operation: "details",
        timeoutMs: DETAILS_TIMEOUT_MS,
      },
      { url: `${OPEN_LIBRARY_URL}/works/${workId}.json`, headers: headers() },
    );

    const parsed = OpenLibraryWorkSchema.safeParse(data);

    if (!parsed.success) {
      throw new MediaError(
        "PROVIDER_BAD_RESPONSE",
        `Open Library returned an unusable work ${workId}`,
        { provider: "openlibrary", cause: parsed.error },
      );
    }

    const work = parsed.data;
    const [people, rating] = await Promise.all([
      fetchAuthorNames(work),
      fetchRating(workId),
    ]);

    const { genres, keywords } = cleanSubjects(work.subjects);

    return {
      mediaKind: classifyBookKind(work.subjects ?? []),
      title: work.title.trim(),
      originalTitle: null,
      originalLanguage: null,
      year: parseYear(work.first_publish_date),
      description: toPlainText(work.description),
      sourceUrl: workUrl(workId),
      identifiers: toIdentifiers(workId),
      imageCandidates: toImageCandidates(work.covers?.[0]),
      rating,
      fields: {
        genres,
        keywords,
        people,
      },
    };
  },
};
