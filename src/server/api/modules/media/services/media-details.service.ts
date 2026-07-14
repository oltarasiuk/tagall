import { MediaError } from "../errors/media.error";
import { providerRegistry, type ProviderRegistryType } from "../providers";
import type { NormalizedItemDetailsType, ProviderNameType } from "../types";
import { enrichBookDetails } from "./book-enrichment.service";

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

  const details = await adapter.getDetails(externalId);

  // Books are described by two providers; the second one is looked up here so
  // the item is stored with both identities and the fuller metadata.
  return enrichBookDetails({ provider, details, registry });
}
