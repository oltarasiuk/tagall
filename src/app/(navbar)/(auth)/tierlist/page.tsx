import { api, HydrateClient } from "../../../../trpc/server";
import {
  TierListContainer,
  type TierListParamsType,
} from "../../../_components/modules/tierlist";
import { BackgroundImage } from "../../../_components/shared";
import { getServerParams } from "../../../../hooks";

export default async function TierListPage() {
  const params = getServerParams<TierListParamsType>();

  void api.collection.getUserCollections.prefetch();
  void api.item.getAllUserItems.prefetch({
    collectionsIds: params.collectionsIds,
    filtering: params.filtering,
    sorting: params.sorting,
  });
  void api.item.getYearsRange.prefetch(params.collectionsIds);
  void api.field.getFilterFields.prefetch(params.collectionsIds);

  return (
    <HydrateClient>
      <BackgroundImage image="/posters5-bg.webp">
        <TierListContainer />
      </BackgroundImage>
    </HydrateClient>
  );
}
