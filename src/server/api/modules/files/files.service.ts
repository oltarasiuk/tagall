import { createHash } from "node:crypto";
import {
  v2 as cloudinary,
  type UploadApiErrorResponse,
  type UploadApiResponse,
} from "cloudinary";
import { env } from "../../../../env";
import { logger } from "~/lib/logger";
import { MediaError } from "../media/errors/media.error";
import { downloadProviderImage } from "../media/services/image-download.service";
import { logMediaOperation } from "../media/services/media-telemetry.service";
import type { ImageCandidateType, MediaKindType } from "../media/types";

cloudinary.config({
  secure: true,
  cloud_name: env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

/**
 * Read-only authenticated ping for on-demand health checks. Creates no asset;
 * just confirms the credentials reach Cloudinary. Never throws — resolves to a
 * plain success/failure the health probe maps to a status.
 */
export const PingCloudinary = async (): Promise<
  { ok: true } | { ok: false; safeMessage: string }
> => {
  try {
    await cloudinary.api.ping();
    return { ok: true };
  } catch {
    return { ok: false, safeMessage: "Cloudinary ping failed" };
  }
};

function extractId(input: string | null | undefined): string | null {
  if (!input) return null;
  const regex = /tagall\/\w+\/(\w+)/;
  const match = regex.exec(input)?.at(1);

  return match ?? null;
}


export const UploadImageByUrl = async (
  folder: string,
  imageUrl: string | null | undefined,
): Promise<string | null> => {
  if (!imageUrl) {
    console.log(`[UploadImageByUrl] No image URL provided, skipping upload`);
    return null;
  }
  
  console.log(`[UploadImageByUrl] Starting to upload image from URL to folder: ${folder}`);
  const startTime = Date.now();
  
  try {
    const response = await cloudinary.uploader.upload(imageUrl, {
      folder: `${env.NEXT_PUBLIC_CLOUDINARY_FOLDER}/${folder}`,
      transformation: [
        { width: 600, crop: "scale" },
        { quality: "auto" },
        { fetch_format: "auto" },
      ],
      timeout: 120_000, // 2 minutes timeout for image upload
    });
    const imageId = extractId(response.public_id);
    const duration = Date.now() - startTime;
    console.log(`[UploadImageByUrl] Image uploaded successfully to ${folder}, ID: ${imageId} (${duration}ms)`);
    return imageId;
  } catch (error) {
    const duration = Date.now() - startTime;
    const err = error as UploadApiErrorResponse;
    console.error(`[UploadImageByUrl] Error uploading image to ${folder} after ${duration}ms:`, err.message);
    throw new Error(`Error uploading image: ${err.message}`);
  }
};

/** Stable, non-guessable public id: the canonical key never leaks into the path. */
const toDeterministicPublicId = (canonicalKey: string): string =>
  createHash("sha256").update(canonicalKey).digest("hex").slice(0, 24);

const uploadBuffer = (
  buffer: Buffer,
  folder: string,
  publicId: string,
): Promise<UploadApiResponse> =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${env.NEXT_PUBLIC_CLOUDINARY_FOLDER}/${folder}`,
        public_id: publicId,
        overwrite: true,
        resource_type: "image",
      },
      (error, result) => {
        if (error || !result) {
          reject(
            new MediaError(
              "POSTER_DOWNLOAD_FAILED",
              `Cloudinary upload failed: ${error?.message ?? "no result"}`,
              { cause: error },
            ),
          );
          return;
        }
        resolve(result);
      },
    );

    stream.end(buffer);
  });

/**
 * Uploads an already-validated image buffer under the item's deterministic
 * public id. The single Cloudinary write path shared by the provider download,
 * manual uploads and generated covers — none of them ever hand Cloudinary a URL
 * to fetch, so a persisted item never hotlinks a source.
 */
export const UploadImageBuffer = async (props: {
  folder: string;
  canonicalKey: string;
  buffer: Buffer;
}): Promise<string> => {
  const { folder, canonicalKey, buffer } = props;

  const publicId = toDeterministicPublicId(canonicalKey);
  const response = await uploadBuffer(buffer, folder, publicId);
  const imageId = extractId(response.public_id);

  if (!imageId) {
    throw new MediaError(
      "POSTER_DOWNLOAD_FAILED",
      "Cloudinary returned an unusable public id",
    );
  }

  return imageId;
};

/**
 * The one way a provider image becomes an item poster.
 *
 * The URL is never handed to Cloudinary to fetch: the server downloads the
 * bytes itself, validates them, re-encodes them, and uploads a buffer. A
 * persisted item therefore never hotlinks a provider, and a malicious or
 * broken URL cannot reach the internal network or smuggle in a non-image.
 */
export const DownloadAndUploadProviderImage = async (props: {
  folder: string;
  canonicalKey: string;
  mediaKind: MediaKindType;
  candidate: ImageCandidateType;
}): Promise<string> => {
  const { folder, canonicalKey, mediaKind, candidate } = props;

  if (!candidate.canPersist) {
    throw new MediaError(
      "POSTER_UNSAFE_URL",
      `${candidate.source} images may not be stored`,
    );
  }

  const startTime = Date.now();
  const image = await downloadProviderImage({
    url: candidate.url,
    mediaKind,
  });

  const imageId = await UploadImageBuffer({
    folder,
    canonicalKey,
    buffer: image.buffer,
  });

  logMediaOperation({
    provider: candidate.source,
    operation: "image",
    canonicalKey,
    durationMs: Date.now() - startTime,
  });

  return imageId;
};

/** Deletes an image uploaded moments ago, e.g. when the DB write then failed. */
export const DeleteUploadedImage = async (
  folder: string,
  publicId: string,
): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(
      `${env.NEXT_PUBLIC_CLOUDINARY_FOLDER}/${folder}/${publicId}`,
    );
  } catch (error) {
    logger.error(
      `[DeleteUploadedImage] Failed to remove orphan image ${publicId}`,
      error,
    );
  }
};

export const UploadImageByBase64 = async (
  folder: string,
  base64Image: string,
): Promise<string | null> => {
  if (!base64Image) {
    console.log(`[UploadImageByBase64] No base64 image provided, skipping upload`);
    return null;
  }
  
  console.log(`[UploadImageByBase64] Starting to upload base64 image to folder: ${folder}`);
  const startTime = Date.now();
  
  try {
    const response = await cloudinary.uploader.upload(base64Image, {
      folder: `${env.NEXT_PUBLIC_CLOUDINARY_FOLDER}/${folder}`,
      transformation: [
        { width: 600, crop: "scale" },
        { quality: "auto" },
        { fetch_format: "auto" },
      ],
      timeout: 120_000, // 2 minutes timeout for image upload
    });
    const imageId = extractId(response.public_id);
    const duration = Date.now() - startTime;
    console.log(`[UploadImageByBase64] Image uploaded successfully to ${folder}, ID: ${imageId} (${duration}ms)`);
    return imageId;
  } catch (error) {
    const duration = Date.now() - startTime;
    const err = error as UploadApiErrorResponse;
    console.error(`[UploadImageByBase64] Error uploading image to ${folder} after ${duration}ms:`, err.message);
    throw new Error(`Error uploading image: ${err.message}`);
  }
};

export const MoveFile = async (
  fromPublicId: string | null | undefined,
  toPublicId: string,
): Promise<UploadApiResponse | null> => {
  if (!fromPublicId) {
    return null;
  }
  const folder = env.NEXT_PUBLIC_CLOUDINARY_FOLDER;
  try {
    return await cloudinary.uploader.rename(
      `${folder}/${fromPublicId}`,
      `${folder}/${toPublicId}`,
    );
  } catch (error) {
    const err = error as UploadApiErrorResponse;
    throw new Error(`Error moving image: ${err.message}`);
  }
};

export const DeleteFile = async (
  folder: string,
  publicId: string | null | undefined,
): Promise<UploadApiResponse | null> => {
  if (!publicId) {
    return null;
  }
  const baseFolder = env.NEXT_PUBLIC_CLOUDINARY_FOLDER;
  try {
    return await cloudinary.uploader.destroy(
      `${baseFolder}/${folder}/${publicId}`,
    );
  } catch (error) {
    const err = error as UploadApiErrorResponse;
    throw new Error(`Error deleting image: ${err.message}`);
  }
};
