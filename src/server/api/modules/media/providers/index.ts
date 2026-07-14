import type { MediaProviderAdapterType } from "../types";
import { anilistProvider } from "./anilist.provider";
import { hardcoverProvider } from "./hardcover.provider";
import { openLibraryProvider } from "./open-library.provider";
import { createProviderRegistry } from "./provider-registry";
import { tmdbProvider } from "./tmdb.provider";
import { vndbProvider } from "./vndb.provider";

/** Adapters are added here as they land; the registry is the only way to reach them. */
const adapters: MediaProviderAdapterType[] = [
  tmdbProvider,
  anilistProvider,
  openLibraryProvider,
  hardcoverProvider,
  vndbProvider,
];

export const providerRegistry = createProviderRegistry(adapters);

export * from "./provider-registry";
