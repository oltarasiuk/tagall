import { providerRequest } from "../services/provider-http.service";
import type { ImageCandidateType } from "../types";
import { normalizeTitle } from "../utils/normalize-title.util";

type MangaDexResponse = { data?: { id?: string; attributes?: { title?: Record<string, string> }; relationships?: { type?: string; attributes?: { fileName?: string } }[] }[] };

/** MangaDex is optional art enrichment; its title must exactly match AniList. */
export async function getMangaDexCover(title: string): Promise<ImageCandidateType[]> {
  try {
    const response = await providerRequest<MangaDexResponse>(
      { provider: "mangadex", operation: "image", timeoutMs: 8_000, maxRetries: 1 },
      { url: "https://api.mangadex.org/manga", params: { title, limit: 5, includes: "cover_art", contentRating: "safe" } },
    );
    const expected = normalizeTitle(title);
    const match = (response.data ?? []).find((manga) => Object.values(manga.attributes?.title ?? {}).some((candidate) => normalizeTitle(candidate) === expected));
    const fileName = match?.relationships?.find((relation) => relation.type === "cover_art")?.attributes?.fileName;
    return match?.id && fileName ? [{ source: "mangadex", url: `https://uploads.mangadex.org/covers/${match.id}/${fileName}`, width: null, height: null, language: null, likes: null, kind: "cover", canPersist: true }] : [];
  } catch {
    return [];
  }
}
