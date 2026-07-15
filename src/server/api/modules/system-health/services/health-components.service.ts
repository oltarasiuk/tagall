import sharp from "sharp";
import type { dbType } from "~/server/db";
import { isRedisConfigured, pingRedis } from "~/lib/redis";
import { PingCloudinary } from "../../files/files.service";
import { GetEmbedding } from "../../open-ai/services";
import { PROVIDER_ATTRIBUTION } from "../../media/constants/provider-attribution.const";
import { isMediaError } from "../../media/errors/media.error";
import { providerRegistry } from "../../media/providers";
import type { MediaKindType } from "../../media/types";
import type {
  DiagnosticCost,
  HealthCategory,
  HealthMode,
  HealthStatus,
  ProbeResult,
} from "../types/health.type";

export type ProbeContext = { db: dbType };

export type ComponentDefinition = {
  id: string;
  category: HealthCategory;
  label: string;
  mode: HealthMode;
  cost: DiagnosticCost;
  /** Env var names that must be non-empty for the component to be configured. */
  requiredEnv: string[];
  /** Whether the feature/provider is intentionally on. */
  isEnabled: () => boolean;
  /** Status shown when configured but not enabled. Defaults to "disabled". */
  disabledStatus?: HealthStatus;
  /** Status shown in the configuration summary for config-only components. */
  configuredStatus?: HealthStatus;
  /** Absent for configuration-only components. */
  probe?: (ctx: ProbeContext) => Promise<ProbeResult>;
};

export const ZERO_COST: DiagnosticCost = {
  databaseQueries: 0,
  redisCommands: 0,
  externalApiRequests: 0,
  cloudinaryOperations: 0,
  potentiallyBillable: false,
};

const cost = (partial: Partial<DiagnosticCost>): DiagnosticCost => ({
  ...ZERO_COST,
  ...partial,
});

/** Stable, benign fixture query per media kind — never user or DB data. */
const FIXTURE_QUERY: Record<MediaKindType, string> = {
  book: "dune",
  comic: "watchmen",
  game: "portal",
  film: "matrix",
  serie: "friends",
  manga: "naruto",
  "visual-novel": "steins gate",
  "board-game": "catan",
};

/** Providers that need no key: they are always "configured". */
const KEYLESS_PROVIDERS = new Set(["openlibrary", "anilist", "vndb", "mangadex"]);

const mapProviderError = (error: unknown): ProbeResult => {
  const code = isMediaError(error) ? error.code : "PROVIDER_BAD_RESPONSE";

  if (code === "PROVIDER_RATE_LIMITED") {
    return { status: "rate_limited", code, safeMessage: "Rate limited; retry later" };
  }
  if (code === "PROVIDER_AUTH_FAILED") {
    return { status: "unavailable", code, safeMessage: "Authentication rejected" };
  }
  if (code === "PROVIDER_DISABLED") {
    return { status: "disabled", code, safeMessage: "Provider is disabled" };
  }
  if (code === "PROVIDER_TIMEOUT") {
    return { status: "degraded", code, safeMessage: "Request timed out" };
  }
  return { status: "unavailable", code, safeMessage: "Provider request failed" };
};

const CORE_COMPONENTS: ComponentDefinition[] = [
  {
    id: "process",
    category: "core",
    label: "Application process",
    mode: "configuration",
    cost: ZERO_COST,
    requiredEnv: [],
    isEnabled: () => true,
    configuredStatus: "healthy",
  },
  {
    id: "auth",
    category: "core",
    label: "Authentication / session",
    mode: "configuration",
    cost: ZERO_COST,
    requiredEnv: [],
    // The protected request that reaches this code already proved the session.
    isEnabled: () => true,
    configuredStatus: "healthy",
  },
  {
    id: "database",
    category: "core",
    label: "PostgreSQL / Prisma",
    mode: "diagnostic",
    cost: cost({ databaseQueries: 1 }),
    requiredEnv: ["DATABASE_URL"],
    isEnabled: () => true,
    probe: async ({ db }) => {
      await db.$queryRaw`SELECT 1`;
      return { status: "healthy", actualCost: { databaseQueries: 1 } };
    },
  },
  {
    id: "redis",
    category: "core",
    label: "Redis cache",
    mode: "diagnostic",
    cost: cost({ redisCommands: 1 }),
    requiredEnv: [],
    isEnabled: isRedisConfigured,
    // Redis is an optional cache: its absence degrades, it never fails the app.
    disabledStatus: "disabled",
    probe: async () => {
      const ok = await pingRedis();
      return ok
        ? { status: "healthy", actualCost: { redisCommands: 1 } }
        : {
            status: "degraded",
            code: "REDIS_UNAVAILABLE",
            safeMessage: "Redis did not answer; running without cache",
            actualCost: { redisCommands: 1 },
          };
    },
  },
  {
    id: "cloudinary",
    category: "core",
    label: "Cloudinary",
    mode: "diagnostic",
    cost: cost({ cloudinaryOperations: 1 }),
    requiredEnv: ["CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"],
    isEnabled: () => true,
    probe: async () => {
      const result = await PingCloudinary();
      return result.ok
        ? { status: "healthy", actualCost: { cloudinaryOperations: 1 } }
        : {
            status: "unavailable",
            code: "CLOUDINARY_PING_FAILED",
            safeMessage: result.safeMessage,
            actualCost: { cloudinaryOperations: 1 },
          };
    },
  },
  {
    id: "embeddings",
    category: "core",
    label: "OpenAI embeddings",
    mode: "diagnostic",
    // Billable: only ever runs when explicitly selected and confirmed.
    cost: cost({ externalApiRequests: 1, potentiallyBillable: true }),
    requiredEnv: ["OPENAI_API_KEY"],
    isEnabled: () => true,
    probe: async () => {
      await GetEmbedding("health check");
      return {
        status: "healthy",
        actualCost: { externalApiRequests: 1, potentiallyBillable: true },
      };
    },
  },
  {
    id: "image-pipeline",
    category: "pipeline",
    label: "Image validation pipeline",
    mode: "diagnostic",
    cost: ZERO_COST,
    requiredEnv: [],
    isEnabled: () => true,
    probe: async () => {
      // Local sharp self-test: encode then decode a tiny image. No network.
      const buffer = await sharp({
        create: {
          width: 2,
          height: 3,
          channels: 3,
          background: { r: 0, g: 0, b: 0 },
        },
      })
        .png()
        .toBuffer();
      const meta = await sharp(buffer).metadata();
      return meta.width === 2
        ? { status: "healthy" }
        : { status: "unavailable", code: "SHARP_SELFTEST_FAILED" };
    },
  },
];

const buildProviderComponents = (): ComponentDefinition[] =>
  providerRegistry.getAll().map((adapter) => {
    const meta = PROVIDER_ATTRIBUTION[adapter.name];
    const keyless = KEYLESS_PROVIDERS.has(adapter.name);
    const kind = adapter.supportedKinds[0] ?? "book";

    return {
      id: `provider-${adapter.name}`,
      category: "provider",
      label: meta.label,
      mode: "diagnostic",
      // IGDB needs a Twitch token before the data request: two round-trips.
      cost: cost({ externalApiRequests: adapter.name === "igdb" ? 2 : 1 }),
      requiredEnv: [],
      isEnabled: () => adapter.enabled,
      disabledStatus:
        adapter.name === "bgg" ? "pending_approval" : "not_configured",
      probe: async () => {
        try {
          await adapter.search({ query: FIXTURE_QUERY[kind], limit: 1 });
          return {
            status: "healthy",
            actualCost: { externalApiRequests: adapter.name === "igdb" ? 2 : 1 },
          };
        } catch (error) {
          return {
            ...mapProviderError(error),
            actualCost: { externalApiRequests: adapter.name === "igdb" ? 2 : 1 },
          };
        }
      },
      // Keyless providers are always configured; keyed ones follow their adapter.
      _keyless: keyless,
    } as ComponentDefinition & { _keyless: boolean };
  });

export const getComponentDefinitions = (): ComponentDefinition[] => [
  ...CORE_COMPONENTS,
  ...buildProviderComponents(),
];

/** True when every required env var is present and non-empty. */
export const isConfigured = (definition: ComponentDefinition): boolean => {
  if ((definition as { _keyless?: boolean })._keyless) return true;
  // A provider awaiting approval (BGG) is configured — the app is set to use it,
  // it just lacks the pending token — so it reads as pending_approval, not
  // not_configured.
  if (definition.disabledStatus === "pending_approval") return true;
  if (definition.requiredEnv.length === 0) {
    // Providers with no declared env are "configured" iff enabled reports so.
    return definition.category === "provider" ? definition.isEnabled() : true;
  }
  return definition.requiredEnv.every((name) => !!process.env[name]);
};
