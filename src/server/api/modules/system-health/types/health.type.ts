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

export type HealthMode = "configuration" | "diagnostic";

/** Each diagnostic declares its expected work; the server returns actual use. */
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
};

export type RunDiagnosticsResult = {
  runId: string;
  startedAt: string;
  completedAt: string;
  components: ComponentHealth[];
  actualCost: DiagnosticCost;
};
