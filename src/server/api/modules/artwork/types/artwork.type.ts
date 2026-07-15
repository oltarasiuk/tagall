import type { MediaKindType, ProviderNameType } from "../../media/types";

/**
 * Where a cover can come from. A superset of the identity providers: `manual`
 * and `generated` produce persistable art but never identify the item itself,
 * so they are deliberately *not* part of the Prisma `ExternalProvider` enum.
 */
export type ArtworkSourceName = ProviderNameType | "manual" | "generated";

export type ArtworkKind = "cover" | "poster" | "grid" | "background";

export type ArtworkAttribution = {
  label: string;
  sourceUrl: string | null;
  creator: string | null;
  license: string | null;
  licenseUrl: string | null;
};

export type ArtworkCandidate = {
  /**
   * Server-issued opaque, signed token. The browser never decides candidate
   * identity: the server re-resolves the real source URL from this before any
   * download, and a tampered token is rejected.
   */
  candidateId: string;
  source: ArtworkSourceName;
  previewUrl: string | null;
  width: number | null;
  height: number | null;
  language: string | null;
  likes: number | null;
  kind: ArtworkKind;
  canPersist: boolean;
  attribution: ArtworkAttribution | null;
};

export type ArtworkSourceError = {
  source: ArtworkSourceName;
  code: string;
  safeMessage: string;
};

export type GetArtworkCandidatesResult = {
  candidates: ArtworkCandidate[];
  sourceErrors: ArtworkSourceError[];
};

/**
 * How the create/update flow should produce the single persisted poster.
 * The client picks a mode; the server does the work and never trusts a raw URL,
 * preview, dimensions or `canPersist` value coming from the browser.
 */
export type ArtworkSelection =
  | { mode: "auto"; allowGeneratedFallback: boolean }
  | { mode: "candidate"; candidateId: string; allowGeneratedFallback: boolean }
  | { mode: "upload"; dataBase64: string }
  | { mode: "manual-url"; url: string }
  | { mode: "generated" };

export type ResolvedArtwork = {
  /** Cloudinary public id stored in `Item.image`. Never a remote URL. */
  imageId: string;
  /** Sanitized source label persisted for on-demand usage analysis. */
  source: ArtworkSourceName;
};

export type ArtworkContext = {
  folder: string;
  canonicalKey: string;
  provider: ProviderNameType;
  externalId: string;
  mediaKind: MediaKindType;
  title: string;
};
