import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { RunDiagnosticsInputSchema } from "./schemas/run-diagnostics-input.schema";
import {
  getConfigurationSummary,
  runDiagnostics,
} from "./services/diagnostic-runner.service";

/**
 * Every procedure is protected (an unauthenticated call gets UNAUTHORIZED).
 * The client starts diagnostics when the health page opens and never polls or
 * refetches them on focus/interval.
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
});
