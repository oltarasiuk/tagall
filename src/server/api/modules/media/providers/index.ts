import type { MediaProviderAdapterType } from "../types";
import { anilistProvider } from "./anilist.provider";
import { hardcoverProvider } from "./hardcover.provider";
import { openLibraryProvider } from "./open-library.provider";
import { createProviderRegistry } from "./provider-registry";
import { tmdbProvider } from "./tmdb.provider";
import { vndbProvider } from "./vndb.provider";
import { igdbProvider } from "./igdb.provider";
import { rawgProvider } from "./rawg.provider";
import { bggProvider } from "./bgg.provider";

/** Adapters are added here as they land; the registry is the only way to reach them. */
const adapters: MediaProviderAdapterType[] = [
  tmdbProvider,
  anilistProvider,
  openLibraryProvider,
  hardcoverProvider,
  vndbProvider,
  igdbProvider,
  rawgProvider,
  bggProvider,
];

export const providerRegistry = createProviderRegistry(adapters);

export * from "./provider-registry";
