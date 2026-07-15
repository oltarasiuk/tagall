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

async function fetchFollowingRedirects(
  url: string,
  requireAllowlistedHost: boolean,
): Promise<Response> {
  let currentUrl = url;

  for (let redirect = 0; redirect <= MAX_IMAGE_REDIRECTS; redirect++) {
    // Both checks run on every hop: a 302 to 169.254.169.254 must not be
    // followed just because the first URL looked fine.
    if (requireAllowlistedHost && !isAllowedImageHost(currentUrl)) {
      throw new MediaError(
        "POSTER_UNSAFE_URL",
        `Image host is not allowed: ${currentUrl}`,
      );
    }
    // A manual URL is not host-restricted, but it still must be HTTP(S), free of
    // embedded credentials, and never a private/reserved address (checked again
    // on every redirect hop). assertPublicUrl enforces that.
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
 * The single validation gate every candidate byte stream passes through:
 * downloaded provider images, manual URLs and direct uploads. sharp — not a
 * Content-Type header or a client claim — decides the real format, the shape is
 * checked for the media kind, and the output is EXIF-rotated, size-capped and
 * re-encoded to WebP.
 */
export async function reencodeValidImage(props: {
  raw: Buffer;
  mediaKind: MediaKindType;
}): Promise<{ buffer: Buffer; width: number; height: number }> {
  const { raw, mediaKind } = props;

  let metadata;
  try {
    metadata = await sharp(raw).metadata();
  } catch (error) {
    throw new MediaError(
      "POSTER_INVALID_IMAGE",
      "Bytes are not a decodable image",
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
  };
}

async function downloadImage(props: {
  url: string;
  mediaKind: MediaKindType;
  requireAllowlistedHost: boolean;
}): Promise<DownloadedImageType> {
  const { url, mediaKind, requireAllowlistedHost } = props;

  const response = await fetchFollowingRedirects(url, requireAllowlistedHost);

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
  const { buffer, width, height } = await reencodeValidImage({ raw, mediaKind });

  return { buffer, width, height, sourceUrl: url };
}

/**
 * Downloads a provider image and hands back a validated, re-encoded buffer.
 * Nothing here trusts the provider: the host must be allowlisted, every
 * redirect is re-checked, the size is capped while streaming, and sharp — not
 * the Content-Type header — decides whether the bytes really are an image.
 */
export function downloadProviderImage(props: {
  url: string;
  mediaKind: MediaKindType;
}): Promise<DownloadedImageType> {
  return downloadImage({ ...props, requireAllowlistedHost: true });
}

/**
 * A manual URL the user typed. It is not restricted to the provider host
 * allowlist — that list is for provider results, not user input — but every
 * other guard stays on: HTTP(S) only, no credentials, no private/reserved IP on
 * any redirect hop, streamed byte cap, MIME check and sharp format/shape
 * validation. (assertPublicUrl has a known DNS-rebinding limitation, acceptable
 * only under this app's single-user/private scope.)
 */
export function downloadManualImage(props: {
  url: string;
  mediaKind: MediaKindType;
}): Promise<DownloadedImageType> {
  return downloadImage({ ...props, requireAllowlistedHost: false });
}

const MAX_UPLOAD_BASE64_LENGTH = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 128;

/**
 * A direct file/clipboard upload arriving as a data URL or bare base64. Bounded
 * before decoding, then validated by the same sharp pipeline as every other
 * source.
 */
export async function decodeAndValidateUpload(props: {
  dataBase64: string;
  mediaKind: MediaKindType;
}): Promise<{ buffer: Buffer; width: number; height: number }> {
  const { dataBase64, mediaKind } = props;

  if (dataBase64.length > MAX_UPLOAD_BASE64_LENGTH) {
    throw new MediaError(
      "ARTWORK_UPLOAD_INVALID",
      `Upload is larger than ${MAX_IMAGE_BYTES} bytes`,
    );
  }

  const base64 = dataBase64.includes(",")
    ? dataBase64.slice(dataBase64.indexOf(",") + 1)
    : dataBase64;

  let raw: Buffer;
  try {
    raw = Buffer.from(base64, "base64");
  } catch (error) {
    throw new MediaError("ARTWORK_UPLOAD_INVALID", "Upload is not valid base64", {
      cause: error,
    });
  }

  if (raw.byteLength === 0 || raw.byteLength > MAX_IMAGE_BYTES) {
    throw new MediaError(
      "ARTWORK_UPLOAD_INVALID",
      `Upload must be between 1 and ${MAX_IMAGE_BYTES} bytes`,
    );
  }

  try {
    return await reencodeValidImage({ raw, mediaKind });
  } catch (error) {
    // Normalize to the upload-specific code so the UI keeps the modal open on
    // the Cover section instead of showing a generic download failure.
    throw new MediaError(
      "ARTWORK_UPLOAD_INVALID",
      "Uploaded file is not a usable cover image",
      { cause: error },
    );
  }
}
