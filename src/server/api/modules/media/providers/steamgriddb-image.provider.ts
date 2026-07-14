import { env } from "~/env";
import { providerRequest } from "../services/provider-http.service";
import type { ImageCandidateType } from "../types";

type SteamGridResponse = {
  data?: { url?: string; width?: number; height?: number; score?: number }[];
};

/**
 * SteamGridDB only supplies art, never a game identity. It is intentionally
 * kept out of the provider registry and used to enrich an IGDB game that has
 * a verified Steam App ID.
 */
export async function getSteamGridImages(steamAppId: string): Promise<ImageCandidateType[]> {
  if (!env.STEAMGRIDDB_API_KEY || !/^\d+$/.test(steamAppId)) return [];
  try {
    const response = await providerRequest<SteamGridResponse>(
      { provider: "steamgriddb", operation: "image", timeoutMs: 8_000, maxRetries: 1 },
      {
        url: `https://www.steamgriddb.com/api/v2/grids/steam/${steamAppId}`,
        headers: { Authorization: `Bearer ${env.STEAMGRIDDB_API_KEY}` },
        params: { dimensions: "600x900,660x930,342x482" },
      },
    );
    return (response.data ?? []).flatMap((grid) => grid.url ? [{
      source: "steamgriddb" as const, url: grid.url, width: grid.width ?? null,
      height: grid.height ?? null, language: null, likes: grid.score ?? null,
      kind: "grid" as const, canPersist: true,
    }] : []);
  } catch {
    // Artwork is an optional enrichment: IGDB's own cover remains usable.
    return [];
  }
}
