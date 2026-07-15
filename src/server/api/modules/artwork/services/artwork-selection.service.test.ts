import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("SECRET_CLIENT_COOKIE_VAR", "test-secret");

const uploadImageBuffer = vi.fn();
const downloadAndUploadProviderImage = vi.fn();
const getMediaDetails = vi.fn();
const generateCoverBuffer = vi.fn();

vi.mock("../../files/files.service", () => ({
  UploadImageBuffer: (...args: unknown[]) => uploadImageBuffer(...args),
  DownloadAndUploadProviderImage: (...args: unknown[]) =>
    downloadAndUploadProviderImage(...args),
}));

vi.mock("../../media/services/media-details.service", () => ({
  getMediaDetails: (...args: unknown[]) => getMediaDetails(...args),
}));

vi.mock("./generated-cover.service", () => ({
  generateCoverBuffer: (...args: unknown[]) => generateCoverBuffer(...args),
}));

const { resolveArtwork } = await import("./artwork-selection.service");
const { encodeCandidateId } = await import("../utils/candidate-token.util");
const { MediaError } = await import("../../media/errors/media.error");

const context = {
  folder: "Game",
  canonicalKey: "igdb:1",
  provider: "igdb" as const,
  externalId: "1",
  mediaKind: "game" as const,
  title: "Dota 2",
};

describe("resolveArtwork", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GENERATED_COVER_FALLBACK_ENABLED", "true");
    uploadImageBuffer.mockResolvedValue("generated-id");
  });

  it("generates a cover when every remote candidate fails in auto mode", async () => {
    downloadAndUploadProviderImage.mockRejectedValue(new Error("broken"));
    generateCoverBuffer.mockResolvedValue(Buffer.from("webp"));

    const result = await resolveArtwork({
      selection: { mode: "auto", allowGeneratedFallback: true },
      context,
      autoImageCandidates: [
        {
          source: "igdb",
          url: "https://images.igdb.com/x.jpg",
          width: null,
          height: null,
          language: null,
          likes: null,
          kind: "cover",
          canPersist: true,
        },
      ],
    });

    expect(generateCoverBuffer).toHaveBeenCalledOnce();
    expect(result).toEqual({ imageId: "generated-id", source: "generated" });
  });

  it("throws POSTER_REQUIRED when the fallback flag is off", async () => {
    vi.stubEnv("GENERATED_COVER_FALLBACK_ENABLED", "false");
    downloadAndUploadProviderImage.mockRejectedValue(new Error("broken"));

    await expect(
      resolveArtwork({
        selection: { mode: "auto", allowGeneratedFallback: true },
        context,
        autoImageCandidates: [],
      }),
    ).rejects.toMatchObject({ code: "POSTER_REQUIRED" });
    expect(generateCoverBuffer).not.toHaveBeenCalled();
  });

  it("returns a typed error when an explicit candidate is unavailable", async () => {
    downloadAndUploadProviderImage.mockRejectedValue(new Error("410 gone"));
    const candidateId = encodeCandidateId({
      s: "igdb",
      u: "https://images.igdb.com/gone.jpg",
      k: "cover",
    });

    await expect(
      resolveArtwork({
        selection: {
          mode: "candidate",
          candidateId,
          allowGeneratedFallback: true,
        },
        context,
      }),
    ).rejects.toMatchObject({ code: "ARTWORK_CANDIDATE_FAILED" });
    // An explicit choice is never silently swapped for a generated cover.
    expect(generateCoverBuffer).not.toHaveBeenCalled();
  });

  it("rejects a tampered candidate token", async () => {
    await expect(
      resolveArtwork({
        selection: {
          mode: "candidate",
          candidateId: "forged.token",
          allowGeneratedFallback: true,
        },
        context,
      }),
    ).rejects.toBeInstanceOf(MediaError);
  });
});
