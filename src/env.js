import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    NEXTAUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    NEXTAUTH_URL: z.preprocess(
      // Ensure full URL: VERCEL_URL is host-only (no scheme); prepend https:// when missing
      // Priority: explicit NEXTAUTH_URL first, fallback to VERCEL_URL
      (str) => {
        const v = str ?? process.env.VERCEL_URL;
        if (typeof v === "string" && v && !/^https?:\/\//i.test(v)) {
          return `https://${v}`;
        }
        return v;
      },
      // VERCEL_URL doesn't include `https` so it cant be validated as a URL
      process.env.VERCEL ? z.string() : z.string().url(),
    ),
    GOOGLE_CLIENT_SECRET: z.string(),
    GOOGLE_CLIENT_ID: z.string(),

    OPENAI_API_KEY: z.string(),

    REDIS_HOST: z.string().optional(),
    REDIS_PORT: z.coerce.number().optional(),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_DB: z.coerce.number().optional(),

    CLOUDINARY_API_KEY: z.string(),
    CLOUDINARY_API_SECRET: z.string(),

    TMDB_ACCESS_TOKEN: z.string().optional(),
    TMDB_API_KEY: z.string().optional(),

    /** When false or unset, IMDB enrichment (Crawlee) is skipped and base TMDB details are used. */
    IMDB_ENRICH_ENABLED: z
      .string()
      .optional()
      .default("false")
      .transform((v) => v === "true" || v === "1"),

    /** Sent as the Open Library User-Agent: identified clients get 3 rps instead of 1. */
    OPEN_LIBRARY_CONTACT_EMAIL: z.string().email().optional(),

    /** Includes the "Bearer " prefix already: Hardcover hands the token out that way. */
    HARDCOVER_API_TOKEN: z.string().optional(),

    IGDB_CLIENT_ID: z.string().optional(),
    IGDB_CLIENT_SECRET: z.string().optional(),
    RAWG_API_KEY: z.string().optional(),
    STEAMGRIDDB_API_KEY: z.string().optional(),
    FANART_TV_PERSONAL_API_KEY: z.string().optional(),
    FANART_TV_PROJECT_API_KEY: z.string().optional(),
    /** BGG remains disabled until the application token is approved. */
    BGG_API_TOKEN: z.string().optional(),

    ALLOWED_EMAILS: z.string(),
    SECRET_CLIENT_COOKIE_VAR: z.string(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string(),
    NEXT_PUBLIC_CLOUDINARY_FOLDER: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME:
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
    REDIS_DB: process.env.REDIS_DB,
    TMDB_ACCESS_TOKEN: process.env.TMDB_ACCESS_TOKEN,
    TMDB_API_KEY: process.env.TMDB_API_KEY,
    IMDB_ENRICH_ENABLED: process.env.IMDB_ENRICH_ENABLED,
    OPEN_LIBRARY_CONTACT_EMAIL: process.env.OPEN_LIBRARY_CONTACT_EMAIL,
    HARDCOVER_API_TOKEN: process.env.HARDCOVER_API_TOKEN,
    IGDB_CLIENT_ID: process.env.IGDB_CLIENT_ID,
    IGDB_CLIENT_SECRET: process.env.IGDB_CLIENT_SECRET,
    RAWG_API_KEY: process.env.RAWG_API_KEY,
    STEAMGRIDDB_API_KEY: process.env.STEAMGRIDDB_API_KEY,
    FANART_TV_PERSONAL_API_KEY: process.env.FANART_TV_PERSONAL_API_KEY,
    FANART_TV_PROJECT_API_KEY: process.env.FANART_TV_PROJECT_API_KEY,
    BGG_API_TOKEN: process.env.BGG_API_TOKEN,
    ALLOWED_EMAILS: process.env.ALLOWED_EMAILS,
    NEXT_PUBLIC_CLOUDINARY_FOLDER: process.env.NEXT_PUBLIC_CLOUDINARY_FOLDER,
    SECRET_CLIENT_COOKIE_VAR: process.env.SECRET_CLIENT_COOKIE_VAR,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
