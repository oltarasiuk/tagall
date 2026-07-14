import { MediaError } from "../errors/media.error";
import {
  VndbResponseSchema,
  VndbVisualNovelSchema,
  type VndbVisualNovelType,
} from "../schemas/vndb.schema";
import { providerRequest } from "../services/provider-http.service";
import type {
  ImageCandidateType,
  MediaProviderAdapterType,
  NormalizedItemDetailsType,
  ProviderSearchInputType,
  ProviderSearchResultType,
} from "../types";
import { normalizeRating } from "../utils/normalize-rating.util";

/**
 * Visual novels live in the Comic collection but are not books: no book source
 * knows them, and searching one for "Steins;Gate" returns noise. They come from
 * VNDB and keep the media kind `visual-novel`, so the UI can label them and the
 * merge step never confuses them with a manga of the same name.
 */

const VNDB_API_URL = "https://api.vndb.org/kana/vn";
const VNDB_VN_URL = "https://vndb.org";

const SEARCH_TIMEOUT_MS = 8_000;
const DETAILS_TIMEOUT_MS = 15_000;

const MAX_GENRES = 10;
const MAX_KEYWORDS = 20;

const FIELDS = [
  "title",
  "alttitle",
  "olang",
  "released",
  "description",
  "image.url",
  "image.dims",
  "image.sexual",
  "image.violence",
  "rating",
  "votecount",
  "platforms",
  "developers.name",
  "tags.name",
  "tags.rating",
  "tags.spoiler",
].join(", ");

/**
 * VNDB rates cover explicitness from 0 (safe) to 2 (explicit). Anything at or
 * above this is not auto-selected as the poster — the user can still supply a
 * cover by hand.
 */
const MAX_AUTO_SEXUAL_FLAG = 1.0;
const MAX_AUTO_VIOLENCE_FLAG = 1.0;

/** VNDB ids are "v17" and are stored exactly as they come. */
const isVndbId = (value: string): boolean => /^v\d+$/.test(value);

const vnUrl = (id: string): string => `${VNDB_VN_URL}/${id}`;

const request = async (
  operation: "search" | "details",
  body: Record<string, unknown>,
): Promise<VndbVisualNovelType[]> => {
  const data = await providerRequest<unknown>(
    {
      provider: "vndb",
      operation,
      timeoutMs: operation === "search" ? SEARCH_TIMEOUT_MS : DETAILS_TIMEOUT_MS,
    },
    {
      url: VNDB_API_URL,
      method: "POST",
      headers: { "content-type": "application/json" },
      data: body,
    },
  );

  return VndbResponseSchema.parse(data).results.flatMap((result) => {
    const parsed = VndbVisualNovelSchema.safeParse(result);

    return parsed.success ? [parsed.data] : [];
  });
};

/** Descriptions carry BBCode-ish markup VNDB renders itself. */
export const cleanDescription = (
  description: string | null | undefined,
): string | null => {
  if (!description) {
    return null;
  }

  const text = description
    .replace(/\[spoiler\][\s\S]*?\[\/spoiler\]/gi, "")
    .replace(/\[url=[^\]]*\]([\s\S]*?)\[\/url\]/gi, "$1")
    .replace(/\[\/?[a-z][^\]]*\]/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text || null;
};

const toImageCandidates = (
  vn: VndbVisualNovelType,
): ImageCandidateType[] => {
  const image = vn.image;

  if (!image?.url) {
    return [];
  }

  // An explicit cover is not persisted automatically; the add flow then asks
  // for one instead of copying it into our Cloudinary.
  if (
    (image.sexual ?? 0) >= MAX_AUTO_SEXUAL_FLAG ||
    (image.violence ?? 0) >= MAX_AUTO_VIOLENCE_FLAG
  ) {
    return [];
  }

  const [width, height] = image.dims ?? [];

  return [
    {
      source: "vndb",
      url: image.url,
      width: width ?? null,
      height: height ?? null,
      language: null,
      likes: null,
      kind: "cover",
      canPersist: true,
    },
  ];
};

/** Spoiler tags are not metadata: they are the plot. Only spoiler-free ones are kept. */
const toTags = (vn: VndbVisualNovelType): string[] =>
  (vn.tags ?? [])
    .filter((tag) => !!tag.name && (tag.spoiler ?? 0) === 0)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .map((tag) => tag.name!)
    .slice(0, MAX_GENRES + MAX_KEYWORDS);

const toRating = (vn: VndbVisualNovelType) =>
  normalizeRating({
    source: "vndb",
    // VNDB reports 10–100; the shared scale is 0–10.
    value: vn.rating ?? null,
    scale: 100,
    votes: vn.votecount ?? null,
  });

const toYear = (released: string | null | undefined): number | null => {
  const year = Number(released?.slice(0, 4));

  return Number.isInteger(year) && year > 1000 ? year : null;
};

const developersOf = (vn: VndbVisualNovelType): string[] =>
  (vn.developers ?? [])
    .map((developer) => developer.name?.trim())
    .filter((name): name is string => !!name);

/**
 * The English title is the display one; `alttitle` holds the original-language
 * title, which is kept as metadata rather than shown.
 */
const titlesOf = (vn: VndbVisualNovelType) => ({
  title: vn.title?.trim() ?? vn.alttitle?.trim() ?? "",
  originalTitle: vn.alttitle?.trim() ?? null,
});

const toSearchResult = (
  vn: VndbVisualNovelType,
  index: number,
): ProviderSearchResultType | null => {
  const { title, originalTitle } = titlesOf(vn);

  if (!vn.id || !title) {
    return null;
  }

  const tags = toTags(vn);

  return {
    provider: "vndb",
    externalId: vn.id,
    mediaKind: "visual-novel",
    title,
    originalTitle,
    originalLanguage: vn.olang ?? null,
    year: toYear(vn.released),
    description: cleanDescription(vn.description),
    authorsOrCreators: developersOf(vn),
    seriesName: null,
    seriesPosition: null,
    identifiers: [
      { provider: "vndb", externalId: vn.id, url: vnUrl(vn.id) },
    ],
    isbns: [],
    imageCandidates: toImageCandidates(vn),
    rating: toRating(vn),
    genres: tags.slice(0, MAX_GENRES),
    keywords: tags.slice(MAX_GENRES),
    relevanceRank: index,
    sourceUrl: vnUrl(vn.id),
  };
};

export const vndbProvider: MediaProviderAdapterType = {
  name: "vndb",
  // Answers the Comic tab, but everything it returns is a visual novel.
  supportedKinds: ["comic", "visual-novel"],
  // Read-only endpoints need no token.
  enabled: true,

  async search(
    input: ProviderSearchInputType,
  ): Promise<ProviderSearchResultType[]> {
    const results = await request("search", {
      filters: ["search", "=", input.query],
      fields: FIELDS,
      sort: "searchrank",
      results: input.limit,
    });

    return results.flatMap((vn, index) => {
      const result = toSearchResult(vn, index);

      return result ? [result] : [];
    });
  },

  async getDetails(externalId: string): Promise<NormalizedItemDetailsType> {
    const id = externalId.trim();

    if (!isVndbId(id)) {
      throw new MediaError(
        "ITEM_NOT_FOUND",
        `"${externalId}" is not a VNDB id`,
        { provider: "vndb" },
      );
    }

    const [vn] = await request("details", {
      filters: ["id", "=", id],
      fields: FIELDS,
      results: 1,
    });

    if (!vn) {
      throw new MediaError("ITEM_NOT_FOUND", `VNDB has no ${id}`, {
        provider: "vndb",
      });
    }

    const { title, originalTitle } = titlesOf(vn);
    const tags = toTags(vn);

    return {
      mediaKind: "visual-novel",
      title,
      originalTitle,
      originalLanguage: vn.olang ?? null,
      year: toYear(vn.released),
      description: cleanDescription(vn.description),
      sourceUrl: vnUrl(id),
      identifiers: [{ provider: "vndb", externalId: id, url: vnUrl(id) }],
      imageCandidates: toImageCandidates(vn),
      rating: toRating(vn),
      fields: {
        genres: tags.slice(0, MAX_GENRES),
        keywords: tags.slice(MAX_GENRES),
        production: developersOf(vn),
        platforms: vn.platforms ?? [],
        originalLanguage: vn.olang ?? null,
      },
    };
  },
};
