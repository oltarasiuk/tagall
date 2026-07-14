import { isAllowedImageHost } from "../constants/image-hosts.const";
import type { ImageCandidateType, MediaKindType, ProviderNameType } from "../types";

/** Best cover source per kind. Everything else keeps its relative order. */
const PROVIDER_PRIORITY: Partial<Record<MediaKindType, ProviderNameType[]>> = {
  game: ["steamgriddb", "igdb", "rawg"],
  film: ["fanart-tv", "tmdb"],
  serie: ["fanart-tv", "tmdb"],
  manga: ["mangadex", "anilist"],
  book: ["openlibrary", "hardcover"],
  comic: ["openlibrary", "hardcover"],
};

export const MAX_IMAGE_ATTEMPTS = 3;

const score = (candidate: ImageCandidateType, mediaKind: MediaKindType) => {
  const priority = PROVIDER_PRIORITY[mediaKind] ?? [];
  const providerRank = priority.indexOf(candidate.source);

  return {
    // Unlisted providers rank after listed ones instead of ahead of them.
    providerRank: providerRank === -1 ? priority.length : providerRank,
    languageRank:
      candidate.language === "en" ? 0 : candidate.language ? 2 : 1,
    // A hero/banner grid is not a poster; keep it as a last resort.
    kindRank: candidate.kind === "grid" ? 1 : 0,
    resolution: (candidate.width ?? 0) * (candidate.height ?? 0),
    likes: candidate.likes ?? 0,
  };
};

/**
 * Orders the candidates the poster pipeline should try, best first, and drops
 * the ones it must not even attempt: a provider that forbids storing copies,
 * or a host outside the allowlist.
 */
export function selectImageCandidates(
  candidates: ImageCandidateType[],
  mediaKind: MediaKindType,
): ImageCandidateType[] {
  return candidates
    .filter(
      (candidate) => candidate.canPersist && isAllowedImageHost(candidate.url),
    )
    .sort((a, b) => {
      const scoreA = score(a, mediaKind);
      const scoreB = score(b, mediaKind);

      return (
        scoreA.providerRank - scoreB.providerRank ||
        scoreA.kindRank - scoreB.kindRank ||
        scoreA.languageRank - scoreB.languageRank ||
        scoreB.resolution - scoreA.resolution ||
        scoreB.likes - scoreA.likes
      );
    })
    .slice(0, MAX_IMAGE_ATTEMPTS);
}
