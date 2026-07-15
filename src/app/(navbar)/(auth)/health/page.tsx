import { api, HydrateClient } from "../../../../trpc/server";
import { SystemHealthContainer } from "../../../_components/modules";
import { BackgroundImage } from "../../../_components/shared";

export default function HealthPage() {
  // Zero-dependency configuration summary only. No DB/Redis/API on page load.
  void api.systemHealth.getConfigurationSummary.prefetch();

  return (
    <HydrateClient>
      <BackgroundImage image="/posters6-bg.webp">
        <SystemHealthContainer />
      </BackgroundImage>
    </HydrateClient>
  );
}
