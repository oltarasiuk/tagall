import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { RunDiagnosticsInputSchema } from "./schemas/run-diagnostics-input.schema";
import {
  getConfigurationSummary,
  runDiagnostics,
} from "./services/diagnostic-runner.service";
import { analyzeStoredUsage } from "./services/stored-usage-analysis.service";

/**
 * On-demand only. Every procedure is protected (an unauthenticated call gets
 * UNAUTHORIZED). Diagnostics and usage analysis are mutations, not queries, so
 * the client never auto-refetches them on focus/interval — there is no passive
 * health traffic.
 */
export const SystemHealthRouter = createTRPCRouter({
  // Page load calls only this: pure in-process config, no DB/Redis/API/Cloudinary.
  getConfigurationSummary: protectedProcedure.query(() =>
    getConfigurationSummary(),
  ),

  runDiagnostics: protectedProcedure
    .input(RunDiagnosticsInputSchema)
    .mutation(({ ctx, input }) =>
      runDiagnostics({ ctx: { db: ctx.db }, componentIds: input.componentIds }),
    ),

  analyzeStoredUsage: protectedProcedure.mutation(({ ctx }) =>
    analyzeStoredUsage({ db: ctx.db }),
  ),
});
