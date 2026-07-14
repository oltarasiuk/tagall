import {
  GetAnilistDetailsById,
  SearchAnilist,
} from "../../parse/services/anilist.service";
import { MediaError } from "../errors/media.error";
import type {
  ImageCandidateType,
  MediaProviderAdapterType,
  NormalizedItemDetailsType,
  ProviderSearchInputType,
  ProviderSearchResultType,
} from "../types";
import { normalizeRating } from "../utils/normalize-rating.util";
import { getMangaDexCover } from "./mangadex-image.provider";

const ANILIST_MANGA_URL = "https://anilist.co/manga";

const toImageCandidates = (url: string | null): ImageCandidateType[] =>
  url
    ? [
        {
          source: "anilist",
          url,
          width: null,
          height: null,
          language: null,
          likes: null,
          kind: "cover",
          canPersist: true,
        },
      ]
    : [];

/** AniList reports averageScore on a 0-100 scale; the service already divides it by 10. */
const toRating = (value: number | null) =>
  normalizeRating({ source: "anilist", value, scale: 10 });

export const anilistProvider: MediaProviderAdapterType = {
  name: "anilist",
  supportedKinds: ["manga"],
  // Public read-only GraphQL API: no key, so it is always available.
  enabled: true,

  async search(
    input: ProviderSearchInputType,
  ): Promise<ProviderSearchResultType[]> {
    const results = await SearchAnilist(input.query, input.limit);

    return results.map((result, index) => ({
      provider: "anilist",
      externalId: result.parsedId,
      mediaKind: "manga",
      title: result.title ?? "",
      originalTitle: null,
      originalLanguage: null,
      year: result.year,
      description: result.description,
      authorsOrCreators: [],
      seriesName: null,
      seriesPosition: null,
      isbns: [],
      identifiers: [
        {
          provider: "anilist",
          externalId: result.parsedId,
          url: `${ANILIST_MANGA_URL}/${result.parsedId}`,
        },
      ],
      imageCandidates: toImageCandidates(result.image),
      rating: toRating(result.rating ?? null),
      genres: [],
      keywords: result.keywords,
      relevanceRank: result.relevanceRank ?? index,
      sourceUrl: `${ANILIST_MANGA_URL}/${result.parsedId}`,
    }));
  },

  async getDetails(externalId: string): Promise<NormalizedItemDetailsType> {
    const details = await GetAnilistDetailsById(externalId);

    if (!details.title) {
      throw new MediaError(
        "PROVIDER_BAD_RESPONSE",
        `AniList returned no title for ${externalId}`,
        { provider: "anilist" },
      );
    }

    const mangaDexCover = await getMangaDexCover(details.title);
    return {
      mediaKind: "manga",
      title: details.title,
      originalTitle: null,
      originalLanguage: null,
      year: details.year,
      description: details.description,
      sourceUrl: `${ANILIST_MANGA_URL}/${externalId}`,
      identifiers: [
        {
          provider: "anilist",
          externalId,
          url: `${ANILIST_MANGA_URL}/${externalId}`,
        },
      ],
      imageCandidates: [...mangaDexCover, ...toImageCandidates(details.image)],
      rating: toRating(details.rating),
      fields: {
        genres: details.genres,
        keywords: details.keywords ?? [],
        people: details.people,
        volumes: details.volumes ?? null,
        chapters: details.chapters ?? null,
      },
    };
  },
};
