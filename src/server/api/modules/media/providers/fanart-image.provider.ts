import { env } from "~/env";
import { providerRequest } from "../services/provider-http.service";
import type { ImageCandidateType, MediaKindType } from "../types";

type FanartResponse = Record<string, { url?: string; lang?: string; likes?: string }[]>;

/** Optional artwork enrichment for TMDB-identified video; failures keep TMDB art. */
export async function getFanartPosters(tmdbId: number, mediaKind: Extract<MediaKindType, "film" | "serie">): Promise<ImageCandidateType[]> {
  const personalKey = env.FANART_TV_PERSONAL_API_KEY;
  const projectKey = env.FANART_TV_PROJECT_API_KEY;
  if (!personalKey && !projectKey) return [];
  try {
    const data = await providerRequest<FanartResponse>(
      { provider: "fanart-tv", operation: "image", timeoutMs: 8_000, maxRetries: 1 },
      { url: `https://webservice.fanart.tv/v3/${mediaKind === "film" ? "movies" : "tv"}/${tmdbId}`, headers: { ...(personalKey ? { "api-key": personalKey } : {}), ...(projectKey ? { "client-key": projectKey } : {}) } },
    );
    const posters = data[mediaKind === "film" ? "movieposter" : "tvposter"] ?? [];
    return posters.flatMap((poster) => poster.url ? [{ source: "fanart-tv" as const, url: poster.url, width: null, height: null, language: poster.lang ?? null, likes: Number(poster.likes) || null, kind: "poster" as const, canPersist: true }] : []);
  } catch {
    return [];
  }
}
