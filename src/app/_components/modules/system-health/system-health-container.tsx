"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../../trpc/react";
import type {
  ComponentHealth,
  HealthStatus,
} from "../../../../server/api/modules/system-health/types/health.type";
import { Button, Card, CardContent, Spinner } from "../../ui";

const STATUS_META: Record<
  HealthStatus,
  { icon: string; label: string; className: string }
> = {
  healthy: { icon: "✓", label: "Healthy", className: "text-green-600" },
  degraded: { icon: "≈", label: "Degraded", className: "text-yellow-600" },
  unavailable: { icon: "✕", label: "Unavailable", className: "text-red-600" },
  rate_limited: {
    icon: "⧗",
    label: "Rate limited",
    className: "text-orange-600",
  },
  disabled: {
    icon: "–",
    label: "Disabled",
    className: "text-muted-foreground",
  },
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
  unknown: {
    icon: "?",
    label: "Not checked",
    className: "text-muted-foreground",
  },
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
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    staleTime: Infinity,
  });
  const runDiagnostics = api.systemHealth.runDiagnostics.useMutation();

  const [results, setResults] = useState<Record<string, ComponentHealth>>({});
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const hasStartedInitialRun = useRef(false);

  const components = useMemo(() => {
    const base = summary.data?.components ?? [];
    return base.map((component) => results[component.id] ?? component);
  }, [results, summary.data]);

  const runnableComponentIds = useMemo(
    () =>
      (summary.data?.components ?? [])
        .filter(
          (component) =>
            component.mode === "diagnostic" &&
            component.configured &&
            component.enabled,
        )
        .map((component) => component.id),
    [summary.data],
  );

  const runChecks = useCallback(
    async (componentIds: string[], showSuccess = false) => {
      if (componentIds.length === 0) return;

      setRunningIds((current) => new Set([...current, ...componentIds]));

      try {
        const run = await runDiagnostics.mutateAsync({ componentIds });
        setResults((previous) => {
          const next = { ...previous };
          for (const component of run.components)
            next[component.id] = component;
          return next;
        });
        if (showSuccess) toast.success("Health check completed");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Diagnostics failed",
        );
      } finally {
        setRunningIds((current) => {
          const next = new Set(current);
          for (const componentId of componentIds) next.delete(componentId);
          return next;
        });
      }
    },
    [runDiagnostics],
  );

  useEffect(() => {
    if (hasStartedInitialRun.current || !summary.data) return;

    hasStartedInitialRun.current = true;
    void runChecks(runnableComponentIds);
  }, [runnableComponentIds, runChecks, summary.data]);

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
          Checks start automatically when this page opens.
        </p>
      </div>

      <div className="space-y-2">
        {components.map((component) => {
          const meta = STATUS_META[component.status];
          const hint = remediation(component);
          const isRunning = runningIds.has(component.id);
          const canRun =
            component.mode === "diagnostic" &&
            component.configured &&
            component.enabled;

          return (
            <Card key={component.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{component.label}</span>
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
                  <span aria-hidden>{isRunning ? "…" : meta.icon}</span>{" "}
                  {isRunning ? "Checking" : meta.label}
                </span>
                {canRun && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => void runChecks([component.id], true)}
                    disabled={isRunning}
                    aria-label={`Run ${component.label} again`}
                    title="Run again"
                  >
                    <RefreshCw
                      className={`size-4 ${isRunning ? "animate-spin" : ""}`}
                    />
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
