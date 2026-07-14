import type { MediaProviderAdapterType } from "../types";
import { anilistProvider } from "./anilist.provider";
import { openLibraryProvider } from "./open-library.provider";
import { createProviderRegistry } from "./provider-registry";
import { tmdbProvider } from "./tmdb.provider";

/** Adapters are added here as they land; the registry is the only way to reach them. */
const adapters: MediaProviderAdapterType[] = [
  tmdbProvider,
  anilistProvider,
  openLibraryProvider,
];

export const providerRegistry = createProviderRegistry(adapters);

export * from "./provider-registry";
