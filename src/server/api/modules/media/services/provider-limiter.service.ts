import Bottleneck from "bottleneck";
import type { ProviderNameType } from "../types";

/**
 * One queue per provider, sized to the limits each one publishes. Requests wait
 * in the queue instead of sleeping inside a request handler, so a burst from
 * the "search all" path cannot exceed a provider's quota.
 */
const LIMITER_OPTIONS: Partial<
  Record<ProviderNameType, Bottleneck.ConstructorOptions>
> = {
  // Open Library: 3 rps for identified (User-Agent) clients.
  openlibrary: { minTime: 334, maxConcurrent: 3 },
  // Hardcover: 60 requests/minute.
  hardcover: { minTime: 1_000, maxConcurrent: 2 },
  // IGDB: 4 rps, max 8 concurrent.
  igdb: { minTime: 250, maxConcurrent: 8 },
  // RAWG: monthly budget on the free tier; stay conservative.
  rawg: { minTime: 500, maxConcurrent: 2 },
  // BGG: roughly 1 request / 5 seconds is the long-standing recommendation.
  bgg: { minTime: 5_000, maxConcurrent: 1 },
  // VNDB: 200 requests / 5 minutes, expensive queries run sequentially.
  vndb: { minTime: 1_500, maxConcurrent: 1 },
  steamgriddb: { minTime: 500, maxConcurrent: 2 },
  "fanart-tv": { minTime: 250, maxConcurrent: 4 },
  mangadex: { minTime: 250, maxConcurrent: 2 },
  tmdb: { minTime: 50, maxConcurrent: 8 },
  imdb: { minTime: 50, maxConcurrent: 8 },
  anilist: { minTime: 700, maxConcurrent: 2 },
};

const DEFAULT_OPTIONS: Bottleneck.ConstructorOptions = {
  minTime: 250,
  maxConcurrent: 4,
};

const limiters = new Map<ProviderNameType, Bottleneck>();

export function getProviderLimiter(provider: ProviderNameType): Bottleneck {
  const existing = limiters.get(provider);

  if (existing) {
    return existing;
  }

  const limiter = new Bottleneck(LIMITER_OPTIONS[provider] ?? DEFAULT_OPTIONS);
  limiters.set(provider, limiter);

  return limiter;
}

export const scheduleProviderRequest = <T>(
  provider: ProviderNameType,
  task: () => Promise<T>,
): Promise<T> => getProviderLimiter(provider).schedule(task);
