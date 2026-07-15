import { api, HydrateClient } from "../../../../../trpc/server";
import { SystemHealthContainer } from "../../../../_components/modules";

export default function SystemHealthPage() {
  // Zero-dependency configuration summary only. No DB/Redis/API on page load.
  void api.systemHealth.getConfigurationSummary.prefetch();

  return (
    <HydrateClient>
      <SystemHealthContainer />
    </HydrateClient>
  );
}
