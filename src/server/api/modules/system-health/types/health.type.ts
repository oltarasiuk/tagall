export const HEALTH_STATUSES = [
  "healthy",
  "degraded",
  "unavailable",
  "rate_limited",
  "disabled",
  "not_configured",
  "pending_approval",
  "unknown",
] as const;

export type HealthStatus = (typeof HEALTH_STATUSES)[number];

export type HealthCategory = "core" | "provider" | "pipeline";

export type HealthMode = "configuration" | "diagnostic" | "usage_analysis";

/**
 * Every diagnostic declares, up front, exactly what it will cost. The UI sums
 * this for the selected checks and asks for confirmation before running; the
 * server returns the *actual* counts, which must not exceed the declared budget.
 */
export type DiagnosticCost = {
  databaseQueries: number;
  redisCommands: number;
  externalApiRequests: number;
  cloudinaryOperations: number;
  potentiallyBillable: boolean;
};

export type ComponentHealth = {
  id: string;
  category: HealthCategory;
  label: string;
  status: HealthStatus;
  configured: boolean | null;
  enabled: boolean;
  mode: HealthMode;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  latencyMs: number | null;
  code: string | null;
  safeMessage: string | null;
  diagnosticCost: DiagnosticCost;
};

/** The result of one probe. No timestamps/latency — the runner adds those. */
export type ProbeResult = {
  status: HealthStatus;
  code?: string | null;
  safeMessage?: string | null;
  /** Actual operations performed, so the runner can report real cost. */
  actualCost?: Partial<DiagnosticCost>;
};

export type ConfigurationSummary = {
  generatedAt: string;
  components: ComponentHealth[];
  storedUsageCost: DiagnosticCost;
};

export type RunDiagnosticsResult = {
  runId: string;
  startedAt: string;
  completedAt: string;
  components: ComponentHealth[];
  actualCost: DiagnosticCost;
};

export type StoredUsageResult = {
  generatedAt: string;
  providerIdentifierCounts: Record<string, number>;
  primaryProviderCounts: Record<string, number>;
  artworkSourceCounts: Record<string, number>;
  generatedCoverCount: number;
};
