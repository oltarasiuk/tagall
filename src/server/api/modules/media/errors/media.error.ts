export const MEDIA_ERROR_CODES = [
  "PROVIDER_DISABLED",
  "PROVIDER_AUTH_FAILED",
  "PROVIDER_RATE_LIMITED",
  "PROVIDER_TIMEOUT",
  "PROVIDER_BAD_RESPONSE",
  "ITEM_NOT_FOUND",
  "ITEM_ALREADY_EXISTS",
  "ALREADY_ADDED",
  "POSTER_REQUIRED",
  "POSTER_DOWNLOAD_FAILED",
  "POSTER_UNSAFE_URL",
  "POSTER_INVALID_IMAGE",
  "MEDIA_KIND_MISMATCH",
  "GOOGLE_IMPORT_REQUIRES_RESOLUTION",
  "ARTWORK_NO_REMOTE_CANDIDATE",
  "ARTWORK_CANDIDATE_FAILED",
  "ARTWORK_UPLOAD_INVALID",
  "ARTWORK_GENERATION_FAILED",
] as const;

export type MediaErrorCodeType = (typeof MEDIA_ERROR_CODES)[number];

/** Carries a stable code so the UI can react (POSTER_REQUIRED opens the cover picker, ALREADY_ADDED links to the item) instead of showing a generic toast. */
export class MediaError extends Error {
  readonly code: MediaErrorCodeType;
  readonly provider: string | null;

  constructor(
    code: MediaErrorCodeType,
    message: string,
    options?: { provider?: string | null; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "MediaError";
    this.code = code;
    this.provider = options?.provider ?? null;
  }
}

export const isMediaError = (error: unknown): error is MediaError =>
  error instanceof MediaError;
