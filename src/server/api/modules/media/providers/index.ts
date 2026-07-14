import type { MediaProviderAdapterType } from "../types";
import { createProviderRegistry } from "./provider-registry";

/** Adapters are added here as they land; the registry is the only way to reach them. */
const adapters: MediaProviderAdapterType[] = [];

export const providerRegistry = createProviderRegistry(adapters);

export * from "./provider-registry";
