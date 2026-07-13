import { api, HydrateClient } from "../../../../trpc/server";
import { BackgroundImage } from "../../../_components/shared";
import {
  ProfileContainer,
  type ProfileParamsType,
} from "../../../_components/modules";
import { getServerParams } from "../../../../hooks";

export default async function Profile() {
  const params = getServerParams<ProfileParamsType>();

  void api.item.getUserItemsStats.prefetch(params.collectionsIds);
  return (
    <HydrateClient>
      <BackgroundImage image="/posters6-bg.webp">
        <ProfileContainer />
      </BackgroundImage>
    </HydrateClient>
  );
}
