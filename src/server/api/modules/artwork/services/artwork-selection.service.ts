import {
  DownloadAndUploadProviderImage,
  UploadImageBuffer,
} from "../../files/files.service";
import { MediaError } from "../../media/errors/media.error";
import {
  decodeAndValidateUpload,
  downloadManualImage,
} from "../../media/services/image-download.service";
import { getMediaDetails } from "../../media/services/media-details.service";
import type { ImageCandidateType, ProviderNameType } from "../../media/types";
import { PROVIDER_NAMES } from "../../media/types/provider.type";
import { selectImageCandidates } from "../../media/utils/select-image-candidates.util";
import type {
  ArtworkContext,
  ArtworkSelection,
  ResolvedArtwork,
} from "../types/artwork.type";
import { generateCoverBuffer } from "./generated-cover.service";
import { decodeCandidateId } from "../utils/candidate-token.util";

const isProviderName = (value: string): value is ProviderNameType =>
  (PROVIDER_NAMES as readonly string[]).includes(value);

/**
 * Read live so tests can toggle it and deployments can flip it without a
 * rebuild. Defaults to enabled (matching env.js) when unset; only an explicit
 * "false"/"0" disables the generated fallback.
 */
const generatedFallbackEnabled = (): boolean => {
  const raw = process.env.GENERATED_COVER_FALLBACK_ENABLED;
  if (raw === undefined) return true;
  return raw !== "false" && raw !== "0";
};

async function generate(context: ArtworkContext): Promise<ResolvedArtwork> {
  const buffer = await generateCoverBuffer({
    canonicalKey: context.canonicalKey,
    title: context.title,
    mediaKind: context.mediaKind,
  });
  const imageId = await UploadImageBuffer({
    folder: context.folder,
    canonicalKey: context.canonicalKey,
    buffer,
  });
  return { imageId, source: "generated" };
}

async function resolveAuto(
  context: ArtworkContext,
  allowGeneratedFallback: boolean,
  autoImageCandidates?: ImageCandidateType[],
): Promise<ResolvedArtwork> {
  // Reuse candidates the caller already fetched; only hit the provider when the
  // update flow resolves artwork without a fresh details call.
  const imageCandidates =
    autoImageCandidates ??
    (
      await getMediaDetails({
        provider: context.provider,
        externalId: context.externalId,
      })
    ).imageCandidates;
  const candidates = selectImageCandidates(imageCandidates, context.mediaKind);

  for (const candidate of candidates) {
    try {
      const imageId = await DownloadAndUploadProviderImage({
        folder: context.folder,
        canonicalKey: context.canonicalKey,
        mediaKind: context.mediaKind,
        candidate,
      });
      return { imageId, source: candidate.source };
    } catch {
      // Try the next candidate; a broken cover[0] must not fail the add.
    }
  }

  if (allowGeneratedFallback && generatedFallbackEnabled()) {
    return generate(context);
  }

  throw new MediaError(
    "POSTER_REQUIRED",
    `No usable cover for "${context.title}". Provide one manually.`,
  );
}

async function resolveCandidate(
  context: ArtworkContext,
  candidateId: string,
): Promise<ResolvedArtwork> {
  const decoded = decodeCandidateId(candidateId);

  // A missing/tampered token, or one pointing at a non-provider source, cannot
  // name a persistable provider cover.
  if (!decoded || !isProviderName(decoded.s)) {
    throw new MediaError(
      "ARTWORK_CANDIDATE_FAILED",
      "The selected cover is no longer available",
    );
  }

  const candidate: ImageCandidateType = {
    source: decoded.s,
    url: decoded.u,
    width: null,
    height: null,
    language: null,
    likes: null,
    kind: decoded.k === "background" ? "grid" : decoded.k,
    canPersist: true,
  };

  try {
    const imageId = await DownloadAndUploadProviderImage({
      folder: context.folder,
      canonicalKey: context.canonicalKey,
      mediaKind: context.mediaKind,
      candidate,
    });
    return { imageId, source: decoded.s };
  } catch (error) {
    // An explicit artistic choice is never silently swapped for a generated
    // cover: the UI decides whether to offer that after seeing this error.
    throw new MediaError(
      "ARTWORK_CANDIDATE_FAILED",
      "The selected cover could not be downloaded",
      { cause: error },
    );
  }
}

/**
 * Turns the user's cover choice into a single persisted Cloudinary asset. Runs
 * outside any DB transaction (all network I/O happens here). Never stores a
 * remote URL, never hotlinks, and never bypasses `canPersist`.
 */
export async function resolveArtwork(props: {
  selection: ArtworkSelection;
  context: ArtworkContext;
  autoImageCandidates?: ImageCandidateType[];
}): Promise<ResolvedArtwork> {
  const { selection, context, autoImageCandidates } = props;

  switch (selection.mode) {
    case "auto":
      return resolveAuto(
        context,
        selection.allowGeneratedFallback,
        autoImageCandidates,
      );

    case "candidate":
      return resolveCandidate(context, selection.candidateId);

    case "manual-url": {
      const image = await downloadManualImage({
        url: selection.url,
        mediaKind: context.mediaKind,
      });
      const imageId = await UploadImageBuffer({
        folder: context.folder,
        canonicalKey: context.canonicalKey,
        buffer: image.buffer,
      });
      return { imageId, source: "manual" };
    }

    case "upload": {
      const { buffer } = await decodeAndValidateUpload({
        dataBase64: selection.dataBase64,
        mediaKind: context.mediaKind,
      });
      const imageId = await UploadImageBuffer({
        folder: context.folder,
        canonicalKey: context.canonicalKey,
        buffer,
      });
      return { imageId, source: "manual" };
    }

    case "generated":
      return generate(context);
  }
}
