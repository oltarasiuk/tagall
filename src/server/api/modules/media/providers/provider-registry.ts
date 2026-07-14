import type {
  MediaKindType,
  MediaProviderAdapterType,
  ProviderNameType,
} from "../types";

export type ProviderRegistryType = {
  getAll(): MediaProviderAdapterType[];
  getEnabled(): MediaProviderAdapterType[];
  getEnabledForKind(mediaKind: MediaKindType): MediaProviderAdapterType[];
  getByName(name: ProviderNameType): MediaProviderAdapterType | null;
  isEnabled(name: ProviderNameType): boolean;
};

/**
 * A provider whose credentials are missing stays registered but disabled: the
 * app reports it as unavailable instead of crashing the whole search.
 */
export function createProviderRegistry(
  adapters: MediaProviderAdapterType[],
): ProviderRegistryType {
  const byName = new Map<ProviderNameType, MediaProviderAdapterType>(
    adapters.map((adapter) => [adapter.name, adapter]),
  );

  const getEnabled = () => adapters.filter((adapter) => adapter.enabled);

  return {
    getAll: () => [...adapters],
    getEnabled,
    getEnabledForKind: (mediaKind) =>
      getEnabled().filter((adapter) =>
        adapter.supportedKinds.includes(mediaKind),
      ),
    getByName: (name) => byName.get(name) ?? null,
    isEnabled: (name) => byName.get(name)?.enabled ?? false,
  };
}
