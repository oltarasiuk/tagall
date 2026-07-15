"use client";
import { api } from "../../../../trpc/react";
import { ProfileUpdateUserModal } from "./profile-update-user-modal";
import { CollectionsTabs, Container, Loading } from "../../shared";
import {
  useDebounce,
  useDebouncedQueryParams,
  useQueryParams,
} from "../../../../hooks";
import { ProfileStatusStats } from "./profile-status-stats";
import { ProfileRateStats } from "./profile-rate-stats";
import { useUserItemsStats } from "../../../../hooks/queries/use-get-user-items-stats.hook";
import { useState } from "react";
import { z } from "zod";
import Link from "next/link";
import { Activity } from "lucide-react";
import { GetUserItemsStatsInputSchema } from "../../../../server/api/modules/item/schemas";
import { Button } from "../../ui";

export const ProfileParamsSchema = z.object({
  collectionsIds: GetUserItemsStatsInputSchema._def.innerType.default([]),
});

export type ProfileParamsType = z.infer<typeof ProfileParamsSchema>;

function ProfileContainer() {
  const [user] = api.user.getUser.useSuspenseQuery();
  const [collections] = api.collection.getUserCollections.useSuspenseQuery();

  const { getParam, setQueryParams } = useQueryParams<ProfileParamsType>({
    schema: ProfileParamsSchema,
    defaultParams: {
      collectionsIds: collections.map((collection) => collection.id),
    },
  });

  const [selectedCollectionsIds, setSelectedCollectionsIds] = useState<
    string[]
  >(getParam("collectionsIds"));

  const debouncedSelectedCollectionsIds = useDebounce(selectedCollectionsIds);

  useDebouncedQueryParams<ProfileParamsType>(
    {
      collectionsIds: selectedCollectionsIds,
    },
    setQueryParams,
  );

  const { stats, isLoading } = useUserItemsStats({
    collectionsIds: debouncedSelectedCollectionsIds,
  });

  return (
    <Container>
      <ProfileUpdateUserModal user={user} />
      <CollectionsTabs
        collections={collections}
        selectedCollectionsIds={selectedCollectionsIds}
        setSelectedCollectionsIds={setSelectedCollectionsIds}
        isMany={false}
        actions={
          <Button asChild variant="secondary" className="gap-2">
            <Link href="/health">
              <Activity className="size-4" />
              System health
            </Link>
          </Button>
        }
      />
      {!isLoading && stats ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <ProfileStatusStats all={stats.all} statusStats={stats.status} />
          <ProfileRateStats rateStats={stats.rate} />
        </div>
      ) : (
        <Loading />
      )}
    </Container>
  );
}
export { ProfileContainer };
