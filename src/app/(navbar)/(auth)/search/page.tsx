import { HydrateClient } from "../../../../trpc/server";
import { BackgroundImage } from "../../../_components/shared";
import { SearchContainer } from "../../../_components/modules";

export default function SearchPage() {
  return (
    <HydrateClient>
      <BackgroundImage image="/posters4-bg.webp">
        <SearchContainer />
      </BackgroundImage>
    </HydrateClient>
  );
}
