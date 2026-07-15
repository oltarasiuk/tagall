"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../../trpc/react";
import type {
  ComponentHealth,
  DiagnosticCost,
  HealthStatus,
  StoredUsageResult,
} from "../../../../server/api/modules/system-health/types/health.type";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
  Spinner,
} from "../../ui";

const STATUS_META: Record<
  HealthStatus,
  { icon: string; label: string; className: string }
> = {
  healthy: { icon: "✓", label: "Healthy", className: "text-green-600" },
  degraded: { icon: "≈", label: "Degraded", className: "text-yellow-600" },
  unavailable: { icon: "✕", label: "Unavailable", className: "text-red-600" },
  rate_limited: { icon: "⧗", label: "Rate limited", className: "text-orange-600" },
  disabled: { icon: "–", label: "Disabled", className: "text-muted-foreground" },
  not_configured: {
    icon: "!",
    label: "Not configured",
    className: "text-muted-foreground",
  },
  pending_approval: {
    icon: "…",
    label: "Pending approval",
    className: "text-blue-600",
  },
  unknown: { icon: "?", label: "Not checked", className: "text-muted-foreground" },
};

type Filter = "all" | "problems" | "disabled";

const isProblem = (status: HealthStatus) =>
  status === "unavailable" || status === "degraded" || status === "rate_limited";

const costLabel = (cost: DiagnosticCost): string => {
  const parts: string[] = [];
  if (cost.databaseQueries) parts.push(`DB: ${cost.databaseQueries}`);
  if (cost.redisCommands) parts.push(`Redis: ${cost.redisCommands}`);
  if (cost.externalApiRequests)
    parts.push(`External APIs: ${cost.externalApiRequests}`);
  if (cost.cloudinaryOperations)
    parts.push(`Cloudinary: ${cost.cloudinaryOperations}`);
  if (parts.length === 0) parts.push("no external cost");
  if (cost.potentiallyBillable) parts.push("may be billable");
  return parts.join(", ");
};

const remediation = (component: ComponentHealth): string | null => {
  if (component.safeMessage) return component.safeMessage;
  if (component.status === "not_configured") {
    return "Add the required environment variable";
  }
  if (component.status === "pending_approval") {
    return "Add BGG_API_TOKEN once the application is approved";
  }
  if (component.status === "disabled") return "Intentionally disabled";
  return null;
};

export const SystemHealthContainer = () => {
  const summary = api.systemHealth.getConfigurationSummary.useQuery(undefined, {
    // On-demand only: never poll, refetch on focus, or refetch on reconnect.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    staleTime: Infinity,
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, ComponentHealth>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [usage, setUsage] = useState<StoredUsageResult | null>(null);

  const runDiagnostics = api.systemHealth.runDiagnostics.useMutation();
  const analyzeUsage = api.systemHealth.analyzeStoredUsage.useMutation();

  const components = useMemo(() => {
    const base = summary.data?.components ?? [];
    return base.map((component) => results[component.id] ?? component);
  }, [summary.data, results]);

  const visible = components.filter((component) => {
    if (filter === "problems") return isProblem(component.status);
    if (filter === "disabled")
      return (
        component.status === "disabled" ||
        component.status === "not_configured" ||
        component.status === "pending_approval"
      );
    return true;
  });

  const selectedCost = useMemo(() => {
    const chosen = (summary.data?.components ?? []).filter((component) =>
      selected.has(component.id),
    );
    return chosen.reduce<DiagnosticCost>(
      (total, component) => ({
        databaseQueries:
          total.databaseQueries + component.diagnosticCost.databaseQueries,
        redisCommands:
          total.redisCommands + component.diagnosticCost.redisCommands,
        externalApiRequests:
          total.externalApiRequests +
          component.diagnosticCost.externalApiRequests,
        cloudinaryOperations:
          total.cloudinaryOperations +
          component.diagnosticCost.cloudinaryOperations,
        potentiallyBillable:
          total.potentiallyBillable ||
          component.diagnosticCost.potentiallyBillable,
      }),
      {
        databaseQueries: 0,
        redisCommands: 0,
        externalApiRequests: 0,
        cloudinaryOperations: 0,
        potentiallyBillable: false,
      },
    );
  }, [summary.data, selected]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const runSelected = async () => {
    const componentIds = [...selected];
    if (componentIds.length === 0) return;

    const confirmed = window.confirm(
      `Run ${componentIds.length} check(s)?\nEstimated budget — ${costLabel(
        selectedCost,
      )}.`,
    );
    if (!confirmed) return;

    try {
      const run = await runDiagnostics.mutateAsync({ componentIds });
      setResults((prev) => {
        const next = { ...prev };
        for (const component of run.components) next[component.id] = component;
        return next;
      });
      toast.success(`Checked ${run.components.length} component(s)`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Diagnostics failed",
      );
    }
  };

  const runUsage = async () => {
    const confirmed = window.confirm(
      `Analyze stored usage?\nEstimated budget — ${costLabel(
        summary.data?.storedUsageCost ?? {
          databaseQueries: 0,
          redisCommands: 0,
          externalApiRequests: 0,
          cloudinaryOperations: 0,
          potentiallyBillable: false,
        },
      )}.`,
    );
    if (!confirmed) return;

    try {
      setUsage(await analyzeUsage.mutateAsync());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Analysis failed");
    }
  };

  if (summary.isLoading) {
    return (
      <div className="flex items-center justify-center p-10">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">System Health</h1>
        <p className="text-sm text-muted-foreground">
          On-demand only. The page load reads configuration; nothing touches the
          database, Redis, Cloudinary or provider APIs until you run a check.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => void runSelected()}
          disabled={selected.size === 0 || runDiagnostics.isPending}
        >
          {runDiagnostics.isPending ? "Running…" : "Run selected checks"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => void runUsage()}
          disabled={analyzeUsage.isPending}
        >
          {analyzeUsage.isPending ? "Analyzing…" : "Analyze stored usage"}
        </Button>
        <div className="ml-auto flex gap-1">
          {(["all", "problems", "disabled"] as Filter[]).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "default" : "secondary"}
              onClick={() => setFilter(value)}
            >
              {value[0]?.toUpperCase()}
              {value.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {selected.size > 0 && (
        <p className="text-xs text-muted-foreground">
          Estimated budget for {selected.size} selected — {costLabel(selectedCost)}.
        </p>
      )}

      <div className="space-y-2">
        {visible.map((component) => {
          const meta = STATUS_META[component.status];
          const hint = remediation(component);
          return (
            <Card key={component.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <input
                  type="checkbox"
                  aria-label={`Select ${component.label}`}
                  checked={selected.has(component.id)}
                  onChange={() => toggle(component.id)}
                  disabled={component.mode === "configuration"}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase text-muted-foreground">
                      {component.category}
                    </span>
                    <span className="font-medium">{component.label}</span>
                  </div>
                  {hint && (
                    <p className="text-xs text-muted-foreground">{hint}</p>
                  )}
                </div>
                {component.latencyMs != null && (
                  <span className="text-xs text-muted-foreground">
                    {component.latencyMs}ms
                  </span>
                )}
                <span className={`text-sm font-medium ${meta.className}`}>
                  <span aria-hidden>{meta.icon}</span> {meta.label}
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {usage && (
        <Card>
          <CardHeader>
            <CardTitle>Stored usage snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <UsageSection
              title="Identifiers by provider"
              counts={usage.providerIdentifierCounts}
            />
            <Separator />
            <UsageSection
              title="Primary identity by provider"
              counts={usage.primaryProviderCounts}
            />
            <Separator />
            <UsageSection
              title="Items by artwork source"
              counts={usage.artworkSourceCounts}
            />
            <Separator />
            <p>Generated covers: {usage.generatedCoverCount}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const UsageSection = (props: {
  title: string;
  counts: Record<string, number>;
}) => {
  const entries = Object.entries(props.counts).sort((a, b) => b[1] - a[1]);
  return (
    <div>
      <p className="mb-1 font-medium">{props.title}</p>
      {entries.length === 0 ? (
        <p className="text-muted-foreground">No data yet</p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 sm:grid-cols-3">
          {entries.map(([label, count]) => (
            <li key={label} className="flex justify-between">
              <span className="truncate text-muted-foreground">{label}</span>
              <span>{count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
