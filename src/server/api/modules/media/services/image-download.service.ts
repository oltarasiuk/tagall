import sharp from "sharp";
import { assertPublicUrl } from "../../../helpers";
import { isAllowedImageHost } from "../constants/image-hosts.const";
import { MediaError } from "../errors/media.error";
import type { MediaKindType } from "../types";
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_REDIRECTS,
  isAcceptablePosterShape,
  isAllowedImageFormat,
  isAllowedImageMimeType,
} from "../utils/image-validation.util";

const DOWNLOAD_TIMEOUT_MS = 15_000;

const MAX_OUTPUT_WIDTH = 1200;
const MAX_OUTPUT_HEIGHT = 1800;
const OUTPUT_QUALITY = 85;

export type DownloadedImageType = {
  buffer: Buffer;
  width: number;
  height: number;
  sourceUrl: string;
};

async function fetchFollowingRedirects(url: string): Promise<Response> {
  let currentUrl = url;

  for (let redirect = 0; redirect <= MAX_IMAGE_REDIRECTS; redirect++) {
    // Both checks run on every hop: a 302 to 169.254.169.254 must not be
    // followed just because the first URL looked fine.
    if (!isAllowedImageHost(currentUrl)) {
      throw new MediaError(
        "POSTER_UNSAFE_URL",
        `Image host is not allowed: ${currentUrl}`,
      );
    }
    await assertPublicUrl(currentUrl);

    const response = await fetch(currentUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });

    if (response.status < 300 || response.status >= 400) {
      return response;
    }

    const location = response.headers.get("location");

    if (!location) {
      throw new MediaError(
        "POSTER_DOWNLOAD_FAILED",
        `Redirect without a location header: ${currentUrl}`,
      );
    }

    currentUrl = new URL(location, currentUrl).toString();
  }

  throw new MediaError(
    "POSTER_UNSAFE_URL",
    `Too many redirects (max ${MAX_IMAGE_REDIRECTS})`,
  );
}

async function readBodyWithLimit(response: Response): Promise<Buffer> {
  const declaredLength = Number(response.headers.get("content-length"));

  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
    throw new MediaError(
      "POSTER_INVALID_IMAGE",
      `Image is larger than ${MAX_IMAGE_BYTES} bytes`,
    );
  }

  if (!response.body) {
    throw new MediaError("POSTER_DOWNLOAD_FAILED", "Empty image response");
  }

  const chunks: Buffer[] = [];
  let total = 0;

  // A missing or lying Content-Length must not let an endless stream through.
  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    total += chunk.byteLength;

    if (total > MAX_IMAGE_BYTES) {
      throw new MediaError(
        "POSTER_INVALID_IMAGE",
        `Image stream exceeded ${MAX_IMAGE_BYTES} bytes`,
      );
    }

    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

/**
 * Downloads a provider image and hands back a validated, re-encoded buffer.
 * Nothing here trusts the provider: the host must be allowlisted, every
 * redirect is re-checked, the size is capped while streaming, and sharp — not
 * the Content-Type header — decides whether the bytes really are an image.
 */
export async function downloadProviderImage(props: {
  url: string;
  mediaKind: MediaKindType;
}): Promise<DownloadedImageType> {
  const { url, mediaKind } = props;

  const response = await fetchFollowingRedirects(url);

  if (!response.ok) {
    throw new MediaError(
      "POSTER_DOWNLOAD_FAILED",
      `Image request failed with ${response.status}`,
    );
  }

  if (!isAllowedImageMimeType(response.headers.get("content-type"))) {
    throw new MediaError(
      "POSTER_INVALID_IMAGE",
      `Unsupported content type: ${response.headers.get("content-type") ?? "none"}`,
    );
  }

  const raw = await readBodyWithLimit(response);

  let metadata;
  try {
    metadata = await sharp(raw).metadata();
  } catch (error) {
    throw new MediaError(
      "POSTER_INVALID_IMAGE",
      "Downloaded bytes are not a decodable image",
      { cause: error },
    );
  }

  if (!isAllowedImageFormat(metadata.format)) {
    throw new MediaError(
      "POSTER_INVALID_IMAGE",
      `Unsupported image format: ${metadata.format ?? "unknown"}`,
    );
  }

  if (!isAcceptablePosterShape(metadata, mediaKind)) {
    throw new MediaError(
      "POSTER_INVALID_IMAGE",
      `Image is not a usable ${mediaKind} cover (${metadata.width ?? "?"}x${metadata.height ?? "?"})`,
    );
  }

  const buffer = await sharp(raw)
    .rotate() // honour EXIF orientation before resizing
    .resize({
      width: MAX_OUTPUT_WIDTH,
      height: MAX_OUTPUT_HEIGHT,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: OUTPUT_QUALITY })
    .toBuffer();

  const output = await sharp(buffer).metadata();

  return {
    buffer,
    width: output.width ?? 0,
    height: output.height ?? 0,
    sourceUrl: url,
  };
}
