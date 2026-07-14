import type { MediaKindType } from "../types";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_REDIRECTS = 3;

export const ALLOWED_IMAGE_MIME_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

/** Formats sharp must confirm; a Content-Type header is a claim, not a fact. */
export const ALLOWED_IMAGE_FORMATS: readonly string[] = [
  "jpeg",
  "jpg",
  "png",
  "webp",
  "avif",
];

export const MIN_IMAGE_WIDTH = 200;
export const MIN_IMAGE_HEIGHT = 300;

/**
 * Covers are portrait. Board game boxes are often square, so they get their own
 * range — a landscape screenshot (RAWG loves them) is never a poster.
 */
const ASPECT_RATIO_RANGES: Record<string, { min: number; max: number }> = {
  default: { min: 0.55, max: 0.85 },
  "board-game": { min: 0.6, max: 1.1 },
};

export const getAspectRatioRange = (mediaKind: MediaKindType) =>
  ASPECT_RATIO_RANGES[mediaKind] ?? ASPECT_RATIO_RANGES.default!;

export const isAllowedImageMimeType = (
  contentType: string | null | undefined,
): boolean => {
  if (!contentType) {
    return false;
  }

  const mime = contentType.split(";")[0]?.trim().toLowerCase() ?? "";

  return ALLOWED_IMAGE_MIME_TYPES.includes(mime);
};

export const isAllowedImageFormat = (
  format: string | null | undefined,
): boolean =>
  !!format && ALLOWED_IMAGE_FORMATS.includes(format.toLowerCase());

export type ImageShapeType = {
  width: number | null | undefined;
  height: number | null | undefined;
};

export function isAcceptablePosterShape(
  shape: ImageShapeType,
  mediaKind: MediaKindType,
): boolean {
  const { width, height } = shape;

  if (!width || !height) {
    return false;
  }

  if (width < MIN_IMAGE_WIDTH || height < MIN_IMAGE_HEIGHT) {
    return false;
  }

  const { min, max } = getAspectRatioRange(mediaKind);
  const ratio = width / height;

  return ratio >= min && ratio <= max;
}
