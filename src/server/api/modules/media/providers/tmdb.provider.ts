import { env } from "~/env";
import {
  findByImdbId,
  getVideoDetailsByImdbId,
  searchVideo,
} from "../../parse/services/tmdb.service";
import { MediaError } from "../errors/media.error";
import type {
  ExternalIdentifierValueType,
  ImageCandidateType,
  MediaProviderAdapterType,
  NormalizedItemDetailsType,
  ProviderSearchInputType,
  ProviderSearchResultType,
} from "../types";
import { normalizeRating } from "../utils/normalize-rating.util";

/**
 * Films and series: metadata comes from TMDB, but the identity is the IMDb id.
 * Every item already stored in this app is keyed by it, and it is the id users
 * recognise — so the adapter is named after the identity namespace, not the
 * HTTP source. The TMDB id is kept as a secondary identifier.
 */

const IMDB_TITLE_URL = "https://www.imdb.com/title";

const isEnabled = (): boolean =>
  Boolean(env.TMDB_ACCESS_TOKEN ?? env.TMDB_API_KEY);

const toImageCandidates = (url: string | null): ImageCandidateType[] =>
  url
    ? [
        {
          source: "tmdb",
          url,
          width: null,
          height: null,
          language: null,
          likes: null,
          kind: "poster",
          canPersist: true,
        },
      ]
    : [];

export const tmdbProvider: MediaProviderAdapterType = {
  name: "imdb",
  supportedKinds: ["film", "serie"],

  get enabled() {
    return isEnabled();
  },

  async search(
    input: ProviderSearchInputType,
  ): Promise<ProviderSearchResultType[]> {
    const results = await searchVideo(input.query, input.limit);

    return results
      .filter((result) => result.parsedId)
      .map((result, index) => {
        const mediaKind = result.mediaType === "tv" ? "serie" : "film";
        const identifiers: ExternalIdentifierValueType[] = [
          {
            provider: "imdb",
            externalId: result.parsedId,
            url: `${IMDB_TITLE_URL}/${result.parsedId}`,
          },
        ];

        return {
          provider: "imdb",
          externalId: result.parsedId,
          mediaKind,
          title: result.title ?? "",
          originalTitle: null,
          originalLanguage: null,
          year: result.year,
          description: result.description,
          authorsOrCreators: [],
          seriesName: null,
          seriesPosition: null,
          identifiers,
          imageCandidates: toImageCandidates(result.image),
          rating: normalizeRating({
            source: "tmdb",
            value: result.rating ?? null,
            scale: 10,
          }),
          genres: [],
          keywords: result.keywords,
          relevanceRank: result.relevanceRank ?? index,
          sourceUrl: `${IMDB_TITLE_URL}/${result.parsedId}`,
        } satisfies ProviderSearchResultType;
      });
  },

  async getDetails(externalId: string): Promise<NormalizedItemDetailsType> {
    const [details, found] = await Promise.all([
      getVideoDetailsByImdbId(externalId),
      findByImdbId(externalId),
    ]);

    if (!details.title) {
      throw new MediaError(
        "PROVIDER_BAD_RESPONSE",
        `TMDB returned no title for ${externalId}`,
        { provider: "imdb" },
      );
    }

    const identifiers: ExternalIdentifierValueType[] = [
      {
        provider: "imdb",
        externalId,
        url: `${IMDB_TITLE_URL}/${externalId}`,
      },
    ];

    if (found) {
      identifiers.push({
        provider: "tmdb",
        externalId: String(found.tmdbId),
        url: null,
      });
    }

    return {
      mediaKind: found?.mediaType === "tv" ? "serie" : "film",
      title: details.title,
      originalTitle: null,
      originalLanguage: null,
      year: details.year,
      description: details.description,
      sourceUrl: `${IMDB_TITLE_URL}/${externalId}`,
      identifiers,
      imageCandidates: toImageCandidates(details.image),
      rating: normalizeRating({
        source: "tmdb",
        value: details.rating,
        scale: 10,
      }),
      fields: {
        genres: details.genres,
        keywords: details.keywords,
        people: details.people,
        production: details.production,
        contentRating: details.contentRating,
        runtime: details.runtime,
      },
    };
  },
};
