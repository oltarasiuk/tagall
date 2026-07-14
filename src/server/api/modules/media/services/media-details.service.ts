import { MediaError } from "../errors/media.error";
import { providerRegistry, type ProviderRegistryType } from "../providers";
import type { NormalizedItemDetailsType, ProviderNameType } from "../types";

/**
 * Details are always re-fetched server-side from provider + external id. The
 * client's copy of the metadata is never trusted for writes.
 */
export async function getMediaDetails(props: {
  provider: ProviderNameType;
  externalId: string;
  registry?: ProviderRegistryType;
}): Promise<NormalizedItemDetailsType> {
  const { provider, externalId, registry = providerRegistry } = props;

  const adapter = registry.getByName(provider);

  if (!adapter) {
    throw new MediaError(
      "PROVIDER_DISABLED",
      `Unknown provider "${provider}"`,
      { provider },
    );
  }

  if (!adapter.enabled) {
    throw new MediaError(
      "PROVIDER_DISABLED",
      `Provider "${provider}" is not configured`,
      { provider },
    );
  }

  return adapter.getDetails(externalId);
}
