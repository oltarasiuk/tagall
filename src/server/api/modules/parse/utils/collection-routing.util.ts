/**
 * Routing is keyed by collection slug, never by the display name: renaming
 * "Serie" to "TV Show" must not silently break search or item creation.
 */

export type SearchSourceType = "video" | "manga";
export type ParseSourceType = "imdb" | "anilist";

export const getSearchSourceBySlug = (
  slug: string,
): SearchSourceType | null => {
  switch (slug) {
    case "film":
    case "serie":
      return "video";
    case "manga":
      return "manga";
    default:
      return null;
  }
};

export const getParseSourceBySlug = (slug: string): ParseSourceType | null => {
  switch (slug) {
    case "film":
    case "serie":
      return "imdb";
    case "manga":
      return "anilist";
    default:
      return null;
  }
};
