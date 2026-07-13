import { api, HydrateClient } from "../../../../trpc/server";
import { TagContainer } from "../../../_components/modules/";
import { BackgroundImage } from "../../../_components/shared";

export default async function Tag() {
  void api.collection.getAll.prefetch();
  void api.tag.getUserTags.prefetch();
  return (
    <HydrateClient>
      <BackgroundImage image="/posters2-bg.webp">
        <TagContainer />
      </BackgroundImage>
    </HydrateClient>
  );
}
