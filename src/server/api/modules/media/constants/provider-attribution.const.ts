import { providerRegistry, type ProviderRegistryType } from "../providers";
import { PROVIDER_NAMES, type ProviderNameType } from "../types/provider.type";

export type ProviderAttributionType = {
  /** Name to credit, exactly as the provider's terms spell it. */
  label: string;
  /** Backlink. RAWG requires an active link on every page carrying their data. */
  url: string;
  /** Verbatim notice a provider requires next to the credit, if any. */
  notice: string | null;
  /**
   * False for identity-only namespaces (an IMDb id comes from TMDB, a Steam app
   * id from IGDB) and for Google Books, whose terms demand its own branded block
   * beside its results rather than a shared footer line.
   */
  showInFooter: boolean;
};

export const PROVIDER_ATTRIBUTION = {
  tmdb: {
    label: "TMDB",
    url: "https://www.themoviedb.org/",
    notice:
      "This product uses the TMDB API but is not endorsed or certified by TMDB.",
    showInFooter: true,
  },
  anilist: {
    label: "AniList",
    url: "https://anilist.co/",
    notice: null,
    showInFooter: true,
  },
  openlibrary: {
    label: "Open Library",
    url: "https://openlibrary.org/",
    notice: null,
    showInFooter: true,
  },
  hardcover: {
    label: "Hardcover",
    url: "https://hardcover.app/",
    notice: null,
    showInFooter: true,
  },
  igdb: {
    label: "IGDB",
    url: "https://www.igdb.com/",
    notice: null,
    showInFooter: true,
  },
  rawg: {
    label: "RAWG",
    url: "https://rawg.io/",
    notice: null,
    showInFooter: true,
  },
  bgg: {
    label: "BoardGameGeek",
    url: "https://boardgamegeek.com/",
    notice: "Powered by BGG.",
    showInFooter: true,
  },
  vndb: {
    label: "VNDB",
    url: "https://vndb.org/",
    notice: null,
    showInFooter: true,
  },
  "fanart-tv": {
    label: "Fanart.tv",
    url: "https://fanart.tv/",
    notice: null,
    showInFooter: true,
  },
  steamgriddb: {
    label: "SteamGridDB",
    url: "https://www.steamgriddb.com/",
    notice: null,
    showInFooter: true,
  },
  mangadex: {
    label: "MangaDex",
    url: "https://mangadex.org/",
    notice: null,
    showInFooter: true,
  },
  "google-books": {
    label: "Google Books",
    url: "https://books.google.com/",
    notice: "Powered by Google",
    showInFooter: false,
  },
  imdb: {
    label: "IMDb",
    url: "https://www.imdb.com/",
    notice: null,
    showInFooter: false,
  },
  steam: {
    label: "Steam",
    url: "https://store.steampowered.com/",
    notice: null,
    showInFooter: false,
  },
} as const satisfies Record<ProviderNameType, ProviderAttributionType>;

export type ActiveProviderAttributionType = ProviderAttributionType & {
  provider: ProviderNameType;
};

/**
 * Only providers that are actually reachable are credited: a footer listing a
 * source whose key is missing would claim a data origin the app never used.
 */
export function getActiveProviderAttributions(
  registry: ProviderRegistryType = providerRegistry,
): ActiveProviderAttributionType[] {
  return PROVIDER_NAMES.filter(
    (provider) =>
      PROVIDER_ATTRIBUTION[provider].showInFooter && registry.isEnabled(provider),
  ).map((provider) => ({ provider, ...PROVIDER_ATTRIBUTION[provider] }));
}
