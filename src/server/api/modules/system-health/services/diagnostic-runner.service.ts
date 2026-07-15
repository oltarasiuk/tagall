import { randomUUID } from "node:crypto";
import { logger } from "~/lib/logger";
import {
  getComponentDefinitions,
  isConfigured,
  ZERO_COST,
  type ComponentDefinition,
  type ProbeContext,
} from "./health-components.service";
import { STORED_USAGE_COST, sumCosts } from "./diagnostic-cost.service";
import type {
  ComponentHealth,
  ConfigurationSummary,
  DiagnosticCost,
  RunDiagnosticsResult,
} from "../types/health.type";

const PROBE_TIMEOUT_MS = 8_000;
const CONCURRENCY = 3;

/** Base health row computed from configuration alone — no DB/Redis/API call. */
const toBaseHealth = (definition: ComponentDefinition): ComponentHealth => {
  const configured = isConfigured(definition);
  const enabled = definition.isEnabled();

  let status: ComponentHealth["status"];
  if (!configured) {
    status = "not_configured";
  } else if (!enabled) {
    status = definition.disabledStatus ?? "disabled";
  } else if (definition.mode === "configuration") {
    status = definition.configuredStatus ?? "healthy";
  } else {
    status = "unknown";
  }

  return {
    id: definition.id,
    category: definition.category,
    label: definition.label,
    status,
    configured,
    enabled,
    mode: definition.mode,
    lastCheckedAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    latencyMs: null,
    code: null,
    safeMessage: null,
    diagnosticCost: definition.cost,
  };
};

/**
 * Zero-dependency configuration summary. Read only in-process env and provider
 * registry state — never the DB, Redis, Cloudinary or any external API. This is
 * all the dashboard's page load is allowed to trigger.
 */
export function getConfigurationSummary(): ConfigurationSummary {
  return {
    generatedAt: new Date().toISOString(),
    components: getComponentDefinitions().map(toBaseHealth),
    storedUsageCost: STORED_USAGE_COST,
  };
}

const withTimeout = async (
  definition: ComponentDefinition,
  ctx: ProbeContext,
): Promise<ComponentHealth> => {
  const base = toBaseHealth(definition);

  // A selected component that is not runnable reports its configuration status;
  // its probe never fires (so a disabled provider makes no request), and its
  // actual cost is zero — nothing ran.
  if (!definition.probe || !base.configured || !base.enabled) {
    return { ...base, diagnosticCost: ZERO_COST };
  }

  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();

  try {
    const result = await Promise.race([
      definition.probe(ctx),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("probe timeout")),
          PROBE_TIMEOUT_MS,
        ),
      ),
    ]);

    const latencyMs = Date.now() - startedAt;
    const healthy = result.status === "healthy";

    return {
      ...base,
      status: result.status,
      code: result.code ?? null,
      safeMessage: result.safeMessage ?? null,
      latencyMs,
      lastCheckedAt: checkedAt,
      lastSuccessAt: healthy ? checkedAt : null,
      lastFailureAt: healthy ? null : checkedAt,
      diagnosticCost: sumCosts([result.actualCost ?? definition.cost]),
    };
  } catch (error) {
    logger.debug(
      `[health] probe ${definition.id} failed: ${
        error instanceof Error ? error.message : "unknown"
      }`,
    );
    return {
      ...base,
      status: "unavailable",
      code: "PROBE_TIMEOUT",
      safeMessage: "The check did not finish in time",
      latencyMs: Date.now() - startedAt,
      lastCheckedAt: checkedAt,
      lastFailureAt: checkedAt,
      diagnosticCost: definition.cost,
    };
  }
};

/** Bounded-concurrency pool so a big selection never fans out all at once. */
async function runPool(
  definitions: ComponentDefinition[],
  ctx: ProbeContext,
): Promise<ComponentHealth[]> {
  const results: ComponentHealth[] = new Array(definitions.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < definitions.length) {
      const index = cursor++;
      const definition = definitions[index]!;
      results[index] = await withTimeout(definition, ctx);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, definitions.length) }, worker),
  );

  return results;
}

// Process-local single-flight: a double click on "Run" reuses the in-flight run
// instead of duplicating every probe. No Redis lock — a health check must not
// create the very state it is meant to observe.
const inFlight = new Map<string, Promise<RunDiagnosticsResult>>();

async function execute(
  componentIds: string[],
  ctx: ProbeContext,
): Promise<RunDiagnosticsResult> {
  const startedAt = new Date().toISOString();
  const selected = new Set(componentIds);
  // Empty selection means "check nothing", never "check all".
  const definitions = getComponentDefinitions().filter((definition) =>
    selected.has(definition.id),
  );

  const components = await runPool(definitions, ctx);

  return {
    runId: randomUUID(),
    startedAt,
    completedAt: new Date().toISOString(),
    components,
    actualCost: sumCosts(components.map((component) => component.diagnosticCost)),
  };
}

export function runDiagnostics(props: {
  ctx: ProbeContext;
  componentIds: string[];
}): Promise<RunDiagnosticsResult> {
  const { ctx, componentIds } = props;
  const key = [...componentIds].sort().join(",");

  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = execute(componentIds, ctx).finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

export type { DiagnosticCost };
