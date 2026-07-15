import { isAllowedImageHost } from "../../media/constants/image-hosts.const";
import { PROVIDER_ATTRIBUTION } from "../../media/constants/provider-attribution.const";
import { isMediaError } from "../../media/errors/media.error";
import { coverPreviewUrl, getWorkEditionCovers } from "../../media/providers/open-library.provider";
import { getMediaDetails } from "../../media/services/media-details.service";
import type {
  ImageCandidateType,
  MediaKindType,
  ProviderNameType,
} from "../../media/types";
import { toProviderName } from "../../media/types/provider.type";
import type {
  ArtworkAttribution,
  ArtworkCandidate,
  ArtworkSourceError,
  GetArtworkCandidatesResult,
} from "../types/artwork.type";
import { encodeCandidateId } from "../utils/candidate-token.util";

const attributionFor = (source: ProviderNameType): ArtworkAttribution => {
  const meta = PROVIDER_ATTRIBUTION[source];
  return {
    label: meta.label,
    sourceUrl: meta.url,
    creator: null,
    license: null,
    licenseUrl: null,
  };
};

/** Open Library gallery previews use the medium cover; the L url is persisted. */
const previewFor = (candidate: ImageCandidateType): string => {
  if (candidate.source === "openlibrary") {
    const match = /\/b\/id\/(\d+)-L\.jpg/.exec(candidate.url);
    const coverId = match?.[1] ? Number(match[1]) : null;
    if (coverId) return coverPreviewUrl(coverId);
  }
  return candidate.url;
};

const toCandidate = (candidate: ImageCandidateType): ArtworkCandidate => ({
  candidateId: encodeCandidateId({
    s: candidate.source,
    u: candidate.url,
    k: candidate.kind,
  }),
  source: candidate.source,
  previewUrl: previewFor(candidate),
  width: candidate.width,
  height: candidate.height,
  language: candidate.language,
  likes: candidate.likes,
  kind: candidate.kind,
  canPersist: candidate.canPersist,
  attribution: attributionFor(candidate.source),
});

/**
 * Gathers every persistable cover the picker can offer for one item, from
 * several sources. One source failing (a slow editions endpoint, a rate-limited
 * grid API) degrades to a partial gallery, never an empty one: the caller still
 * gets the identity provider's own cover plus a typed source error.
 */
export async function getArtworkCandidates(props: {
  provider: ProviderNameType;
  externalId: string;
  mediaKind: MediaKindType;
}): Promise<GetArtworkCandidatesResult> {
  const { provider, externalId, mediaKind } = props;

  const sourceErrors: ArtworkSourceError[] = [];
  const collected: ImageCandidateType[] = [];

  // The identity provider's details already aggregate its own cover plus any
  // enrichment (IGDB + SteamGridDB, Open Library + Hardcover).
  try {
    const details = await getMediaDetails({ provider, externalId });
    collected.push(...details.imageCandidates);
  } catch (error) {
    sourceErrors.push({
      source: provider,
      code: isMediaError(error) ? error.code : "PROVIDER_BAD_RESPONSE",
      safeMessage: `Could not load covers from ${PROVIDER_ATTRIBUTION[provider].label}`,
    });
  }

  // Books/comics: expand the gallery with covers from other editions of the work.
  if (mediaKind === "book" || mediaKind === "comic") {
    const workId = collected.find((c) => c.source === "openlibrary")
      ? externalId
      : null;
    const openLibraryId =
      provider === "openlibrary" ? externalId : workId ?? null;

    if (openLibraryId) {
      try {
        collected.push(...(await getWorkEditionCovers(openLibraryId)));
      } catch (error) {
        sourceErrors.push({
          source: toProviderName("OPEN_LIBRARY"),
          code: isMediaError(error) ? error.code : "PROVIDER_BAD_RESPONSE",
          safeMessage: "Could not load additional edition covers",
        });
      }
    }
  }

  // Keep only persistable, allowlisted, background-free candidates and dedupe.
  const seen = new Set<string>();
  const candidates: ArtworkCandidate[] = [];

  for (const candidate of collected) {
    if (!candidate.canPersist) continue;
    if (!isAllowedImageHost(candidate.url)) continue;
    if (seen.has(candidate.url)) continue;
    seen.add(candidate.url);
    candidates.push(toCandidate(candidate));
  }

  return { candidates, sourceErrors };
}
