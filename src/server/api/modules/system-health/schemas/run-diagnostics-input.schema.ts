import { z } from "zod";

export const RunDiagnosticsInputSchema = z.object({
  // Explicit selection only. An empty list checks nothing — never "check all".
  componentIds: z.array(z.string().min(1)).max(64),
});

export type RunDiagnosticsInputType = z.infer<typeof RunDiagnosticsInputSchema>;
