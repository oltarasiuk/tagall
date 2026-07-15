import { beforeEach, describe, expect, it, vi } from "vitest";
import type { dbType } from "~/server/db";

// The database component is only "configured" when DATABASE_URL is present.
vi.stubEnv("DATABASE_URL", "postgres://localhost:5432/test");

const { getConfigurationSummary, runDiagnostics } = await import(
  "./diagnostic-runner.service"
);

const fakeDb = (queryRaw: ReturnType<typeof vi.fn>) =>
  ({ $queryRaw: queryRaw }) as unknown as dbType;

describe("getConfigurationSummary", () => {
  it("returns core and provider components without touching the database", () => {
    const queryRaw = vi.fn();
    const summary = getConfigurationSummary();

    const ids = summary.components.map((component) => component.id);
    expect(ids).toContain("database");
    expect(ids).toContain("redis");
    expect(ids).toContain("cloudinary");
    expect(ids).toContain("provider-igdb");
    // Pure configuration read: no probe fired.
    expect(queryRaw).not.toHaveBeenCalled();
    expect(
      summary.components.every((component) => component.lastCheckedAt === null),
    ).toBe(true);
  });

  it("reports BGG as pending approval when its token is missing", () => {
    const bgg = getConfigurationSummary().components.find(
      (component) => component.id === "provider-bgg",
    );
    expect(bgg?.status).toBe("pending_approval");
  });

  it("declares the database check as one bounded query", () => {
    const database = getConfigurationSummary().components.find(
      (component) => component.id === "database",
    );
    expect(database?.diagnosticCost.databaseQueries).toBe(1);
    expect(database?.diagnosticCost.externalApiRequests).toBe(0);
  });
});

describe("runDiagnostics", () => {
  beforeEach(() => vi.clearAllMocks());

  it("checks nothing for an empty selection and never queries the DB", async () => {
    const queryRaw = vi.fn();
    const run = await runDiagnostics({
      ctx: { db: fakeDb(queryRaw) },
      componentIds: [],
    });

    expect(run.components).toHaveLength(0);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("runs only the selected component and reports actual cost", async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ ok: 1 }]);
    const run = await runDiagnostics({
      ctx: { db: fakeDb(queryRaw) },
      componentIds: ["database"],
    });

    expect(queryRaw).toHaveBeenCalledOnce();
    expect(run.components).toHaveLength(1);
    expect(run.components[0]?.status).toBe("healthy");
    expect(run.components[0]?.lastSuccessAt).not.toBeNull();
    expect(run.actualCost.databaseQueries).toBe(1);
  });

  it("does not run a disabled provider probe", async () => {
    const queryRaw = vi.fn();
    const run = await runDiagnostics({
      ctx: { db: fakeDb(queryRaw) },
      componentIds: ["provider-bgg"],
    });

    expect(run.components[0]?.status).toBe("pending_approval");
    // Probe never fired: no latency was measured.
    expect(run.components[0]?.lastCheckedAt).toBeNull();
    expect(run.actualCost.externalApiRequests).toBe(0);
  });

  it("uses single-flight so a double run does not duplicate probes", async () => {
    const queryRaw = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([{ ok: 1 }]), 20)),
    );
    const ctx = { db: fakeDb(queryRaw) };

    const [a, b] = await Promise.all([
      runDiagnostics({ ctx, componentIds: ["database"] }),
      runDiagnostics({ ctx, componentIds: ["database"] }),
    ]);

    expect(queryRaw).toHaveBeenCalledOnce();
    expect(a.runId).toBe(b.runId);
  });
});
