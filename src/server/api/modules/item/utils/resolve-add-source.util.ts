import { getMediaKindForCollectionSlug } from "../../media/constants/media-kind.const";
import { MediaError } from "../../media/errors/media.error";
import { providerRegistry, type ProviderRegistryType } from "../../media/providers";
import type { ProviderNameType } from "../../media/types";
import { toProviderName } from "../../media/types/provider.type";
import { parseCanonicalKey } from "../../media/utils/canonical-key.util";

export type AddSourceType = {
  provider: ProviderNameType;
  externalId: string;
};

/**
 * Which provider a search result came from, and under which id.
 *
 * Search results carry the canonical key ("openlibrary:OL893415W"), so the
 * answer is normally read straight off it — guessing from the collection breaks
 * as soon as two providers answer for one media kind (Open Library and
 * Hardcover both return books).
 *
 * A bare id is still accepted for results that were cached before the key
 * changed shape; it resolves through the collection's first enabled provider,
 * which is exactly the old behaviour.
 */
export function resolveAddSource(props: {
  parsedId: string;
  collectionSlug: string;
  registry?: ProviderRegistryType;
}): AddSourceType {
  const { parsedId, collectionSlug, registry = providerRegistry } = props;

  const canonical = parseCanonicalKey(parsedId);

  if (canonical) {
    const provider = toProviderName(canonical.provider);
    const adapter = registry.getByName(provider);

    if (!adapter?.enabled) {
      throw new MediaError(
        "PROVIDER_DISABLED",
        `Provider "${provider}" is not available`,
        { provider },
      );
    }

    return { provider, externalId: canonical.externalId };
  }

  const mediaKind = getMediaKindForCollectionSlug(collectionSlug);

  if (!mediaKind) {
    throw new MediaError(
      "PROVIDER_DISABLED",
      `No provider for collection "${collectionSlug}"`,
    );
  }

  const [adapter] = registry.getEnabledForKind(mediaKind);

  if (!adapter) {
    throw new MediaError(
      "PROVIDER_DISABLED",
      `No enabled provider for "${mediaKind}"`,
    );
  }

  return { provider: adapter.name, externalId: parsedId.trim() };
}
