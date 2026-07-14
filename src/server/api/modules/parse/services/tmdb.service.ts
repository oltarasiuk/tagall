import axios from "axios";
import { env } from "~/env";
import type { ImdbDetailsResultType, SearchResultType } from "../types";
import type { TmdbMediaType } from "../types/tmdb-media-type.type";
import { getOrSetCache } from "../../../../../lib/redis";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

function getAuthHeaders(): Record<string, string> {
  if (env.TMDB_ACCESS_TOKEN) {
    return { Authorization: `Bearer ${env.TMDB_ACCESS_TOKEN}` };
  }
  if (env.TMDB_API_KEY) {
    return {};
  }
  throw new Error(
    "TMDB: Set either TMDB_ACCESS_TOKEN or TMDB_API_KEY in environment",
  );
}

function getAuthParams(): Record<string, string> {
  if (env.TMDB_ACCESS_TOKEN) return {};
  if (env.TMDB_API_KEY) return { api_key: env.TMDB_API_KEY };
  return {};
}

async function tmdbGet<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = `${TMDB_BASE}${path}`;
  const allParams = { ...getAuthParams(), ...params };
  const response = await axios.get<T>(url, {
    headers: getAuthHeaders(),
    params: allParams,
    timeout: 15000,
  });
  return response.data;
}

type TmdbSearchMovieResult = {
  id: number;
  title: string | null;
  overview: string | null;
  poster_path: string | null;
  release_date: string | null;
  vote_average?: number;
};

type TmdbSearchTvResult = {
  id: number;
  name: string | null;
  overview: string | null;
  poster_path: string | null;
  first_air_date: string | null;
  vote_average?: number;
};

type TmdbSearchMovieResponse = { results: TmdbSearchMovieResult[] };
type TmdbSearchTvResponse = { results: TmdbSearchTvResult[] };

type TmdbFindResult = {
  id: number;
  poster_path: string | null;
  overview: string | null;
};

type TmdbFindResponse = {
  movie_results: TmdbFindResult[];
  tv_results: TmdbFindResult[];
};

type TmdbExternalIdsResponse = { imdb_id: string | null };

type TmdbGenre = { id: number; name: string };
type TmdbProductionCompany = { name: string };

type TmdbMovieDetails = {
  id: number;
  title: string | null;
  overview: string | null;
  poster_path: string | null;
  release_date: string | null;
  runtime: number | null;
  genres: TmdbGenre[];
  adult: boolean;
  vote_average: number | null;
  production_companies: TmdbProductionCompany[];
};

type TmdbTvDetails = {
  id: number;
  name: string | null;
  overview: string | null;
  poster_path: string | null;
  first_air_date: string | null;
  episode_run_time: number[];
  genres: TmdbGenre[];
  adult: boolean;
  vote_average: number | null;
  production_companies: TmdbProductionCompany[];
};

type TmdbCreditsResponse = {
  cast: Array<{ name: string }>;
  crew: Array<{ name: string; job?: string }>;
};

type TmdbKeywordsMovieResponse = { keywords: Array<{ name: string }> };
type TmdbKeywordsTvResponse = { results: Array<{ name: string }> };

type TmdbReleaseDatesResponse = {
  results: Array<{
    iso_3166_1: string;
    release_dates: Array<{ certification: string | null }>;
  }>;
};

type TmdbContentRatingsResponse = {
  results: Array<{
    iso_3166_1: string;
    rating: string | null;
  }>;
};

function posterUrl(path: string | null): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}${path}`;
}

function yearFromDate(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const y = parseInt(dateStr.slice(0, 4), 10);
  return Number.isNaN(y) ? null : y;
}

/**
 * Resolve TMDB movie or TV id to imdb_id. Returns null if not found.
 */
async function getImdbIdFromTmdb(
  mediaType: TmdbMediaType,
  tmdbId: number,
): Promise<string | null> {
  const path =
    mediaType === "movie"
      ? `/movie/${tmdbId}/external_ids`
      : `/tv/${tmdbId}/external_ids`;
  const data = await tmdbGet<TmdbExternalIdsResponse>(path);
  const imdbId = data.imdb_id?.trim() ?? null;
  return imdbId || null;
}

/**
 * Unified video search: runs movie + TV search in parallel, resolves imdb_id for each result,
 * merges and returns up to `limit` results with parsedId = imdb_id.
 */
export async function searchVideo(
  query: string,
  limit: number,
): Promise<SearchResultType[]> {
  const [movieRes, tvRes] = await Promise.all([
    tmdbGet<TmdbSearchMovieResponse>("/search/movie", {
      query: query.trim(),
      page: "1",
    }),
    tmdbGet<TmdbSearchTvResponse>("/search/tv", {
      query: query.trim(),
      page: "1",
    }),
  ]);

  const candidates: Array<{
    title: string | null;
    image: string | null;
    year: number | null;
    description: string | null;
    keywords: string[];
    mediaType: TmdbMediaType;
    tmdbId: number;
    voteAverage: number | null;
  }> = [];

  for (const m of movieRes.results.slice(0, 15)) {
    candidates.push({
      title: m.title ?? null,
      image: posterUrl(m.poster_path),
      year: yearFromDate(m.release_date),
      description: m.overview ?? null,
      keywords:
        m.vote_average != null ? [`${m.vote_average.toFixed(1)} tmdb`] : [],
      mediaType: "movie",
      tmdbId: m.id,
      voteAverage: m.vote_average ?? null,
    });
  }
  for (const t of tvRes.results.slice(0, 15)) {
    candidates.push({
      title: t.name ?? null,
      image: posterUrl(t.poster_path),
      year: yearFromDate(t.first_air_date),
      description: t.overview ?? null,
      keywords:
        t.vote_average != null ? [`${t.vote_average.toFixed(1)} tmdb`] : [],
      mediaType: "tv",
      tmdbId: t.id,
      voteAverage: t.vote_average ?? null,
    });
  }

  const results: SearchResultType[] = [];
  const seenImdb = new Set<string>();

  for (const c of candidates) {
    if (results.length >= limit) break;
    try {
      const imdbId = await getImdbIdFromTmdb(c.mediaType, c.tmdbId);
      if (!imdbId || seenImdb.has(imdbId)) continue;
      seenImdb.add(imdbId);
      results.push({
        id: null,
        provider: "imdb",
        externalId: imdbId,
        mediaKind: c.mediaType === "movie" ? "film" : "serie",
        title: c.title,
        image: c.image,
        year: c.year,
        description: c.description,
        keywords: c.keywords,
        parsedId: imdbId,
        mediaType: c.mediaType,
        rating: c.voteAverage,
      });
    } catch {
      continue;
    }
  }

  return results.slice(0, limit);
}

/**
 * Find media_type and TMDB id by IMDb id.
 */
export type TmdbFindResult2 = {
  mediaType: TmdbMediaType;
  tmdbId: number;
  posterUrl: string | null;
  description: string | null;
};

export async function findByImdbId(
  imdbId: string,
): Promise<TmdbFindResult2 | null> {
  const id = imdbId.startsWith("tt") ? imdbId : `tt${imdbId}`;
  const data = await tmdbGet<TmdbFindResponse>(`/find/${id}`, {
    external_source: "imdb_id",
  });
  if (data.movie_results?.[0]) {
    const result = data.movie_results[0];
    return {
      mediaType: "movie",
      tmdbId: result.id,
      posterUrl: result.poster_path
        ? `${TMDB_IMAGE_BASE}${result.poster_path}`
        : null,
      description: result.overview ?? null,
    };
  }
  if (data.tv_results?.[0]) {
    const result = data.tv_results[0];
    return {
      mediaType: "tv",
      tmdbId: result.id,
      posterUrl: result.poster_path
        ? `${TMDB_IMAGE_BASE}${result.poster_path}`
        : null,
      description: result.overview ?? null,
    };
  }
  return null;
}

async function getMovieDetailsCached(
  tmdbId: number,
): Promise<ImdbDetailsResultType> {
  return getOrSetCache(
    () => getMovieDetailsUncached(tmdbId),
    "parse",
    "tmdbMovieDetails",
    { tmdbId },
    60 * 60 * 24,
  );
}

async function getMovieDetailsUncached(
  tmdbId: number,
): Promise<ImdbDetailsResultType> {
  const [movie, credits, keywords, releaseDates] = await Promise.all([
    tmdbGet<TmdbMovieDetails>(`/movie/${tmdbId}`),
    tmdbGet<TmdbCreditsResponse>(`/movie/${tmdbId}/credits`),
    tmdbGet<TmdbKeywordsMovieResponse>(`/movie/${tmdbId}/keywords`),
    tmdbGet<TmdbReleaseDatesResponse>(`/movie/${tmdbId}/release_dates`),
  ]);

  const people = [
    ...(credits.cast?.slice(0, 15).map((c) => c.name) ?? []),
    ...(credits.crew?.filter((c) => c.job === "Director").map((c) => c.name) ??
      []),
  ];
  const cert =
    releaseDates.results?.find((r) => r.iso_3166_1 === "US")?.release_dates?.[0]
      ?.certification ?? null;

  return {
    title: movie.title ?? null,
    year: yearFromDate(movie.release_date),
    image: posterUrl(movie.poster_path),
    description: movie.overview ?? null,
    keywords: keywords.keywords?.map((k) => k.name) ?? [],
    genres: movie.genres?.map((g) => g.name) ?? [],
    people,
    runtime: movie.runtime != null ? `${movie.runtime} min` : null,
    type: {
      titleType: "movie",
      isSeries: false,
      isEpisode: false,
      canHaveEpisodes: false,
    },
    isAdult: movie.adult ?? false,
    contentRating: cert,
    rating: movie.vote_average ?? null,
    production: movie.production_companies?.map((c) => c.name) ?? [],
  };
}

async function getTvDetailsCached(
  tmdbId: number,
): Promise<ImdbDetailsResultType> {
  return getOrSetCache(
    () => getTvDetailsUncached(tmdbId),
    "parse",
    "tmdbTvDetails",
    { tmdbId },
    60 * 60 * 24,
  );
}

async function getTvDetailsUncached(
  tmdbId: number,
): Promise<ImdbDetailsResultType> {
  const [tv, credits, keywords, contentRatings] = await Promise.all([
    tmdbGet<TmdbTvDetails>(`/tv/${tmdbId}`),
    tmdbGet<TmdbCreditsResponse>(`/tv/${tmdbId}/credits`),
    tmdbGet<TmdbKeywordsTvResponse>(`/tv/${tmdbId}/keywords`),
    tmdbGet<TmdbContentRatingsResponse>(`/tv/${tmdbId}/content_ratings`),
  ]);

  const people = [
    ...(credits.cast?.slice(0, 15).map((c) => c.name) ?? []),
    ...(credits.crew?.filter((c) => c.job === "Director").map((c) => c.name) ??
      []),
  ];
  const cert =
    contentRatings.results?.find((r) => r.iso_3166_1 === "US")?.rating ?? null;
  const runtimeMin =
    tv.episode_run_time?.[0] != null ? `${tv.episode_run_time[0]} min` : null;

  return {
    title: tv.name ?? null,
    year: yearFromDate(tv.first_air_date),
    image: posterUrl(tv.poster_path),
    description: tv.overview ?? null,
    keywords: keywords.results?.map((k) => k.name) ?? [],
    genres: tv.genres?.map((g) => g.name) ?? [],
    people,
    runtime: runtimeMin,
    type: {
      titleType: "tv",
      isSeries: true,
      isEpisode: false,
      canHaveEpisodes: true,
    },
    isAdult: tv.adult ?? false,
    contentRating: cert,
    rating: tv.vote_average ?? null,
    production: tv.production_companies?.map((c) => c.name) ?? [],
  };
}

/**
 * Get full video details by IMDb id. Uses TMDB find + movie/tv details.
 * Returns the same shape as ImdbDetailsResultType for compatibility with CreateItem.
 */
export async function getVideoDetailsByImdbId(
  imdbId: string,
): Promise<ImdbDetailsResultType> {
  const found = await findByImdbId(imdbId);
  if (!found) {
    throw new Error(`TMDB: No movie or TV show found for IMDb id ${imdbId}`);
  }
  if (found.mediaType === "movie") {
    return getMovieDetailsCached(found.tmdbId);
  }
  return getTvDetailsCached(found.tmdbId);
}
