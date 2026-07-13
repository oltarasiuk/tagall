"use client";

import { useState, useEffect, useMemo } from "react";
import type {
  GetUserItemsFilterType,
  GetUserItemsSortType,
} from "../../../../server/api/modules/item/types";
import { Container, BackgroundImage } from "../../shared";
import { PublicUserHeader } from "./public-user-header";
import {
  useQueryParams,
  useDebounce,
  useGetPublicUserItemsStats,
} from "../../../../hooks";
import { PublicHomeParamsSchema, type PublicHomeParamsType } from "./schemas";
import { api } from "../../../../trpc/react";
import { PublicStandardView } from "./public-standard-view";
import { PublicTierListView } from "./public-tier-list-view";
import { PublicRandomView } from "./public-random-view";

export function PublicHomeContainer() {
  const [user] = api.user.getPublicUser.useSuspenseQuery();
  const [collections] =
    api.collection.getPublicUserCollections.useSuspenseQuery();

  const { getParam, setQueryParams } = useQueryParams<PublicHomeParamsType>({
    schema: PublicHomeParamsSchema,
    defaultParams: {
      filtering: [{ name: "status", type: "include", value: "COMPLETED" }],
      sorting: { name: "date", type: "desc" },
      viewMode: "standard",
      collectionsIds:
        collections.length > 0 && collections[0] ? [collections[0].id] : [],
    },
  });

  const [selectedCollectionsIds, setSelectedCollectionsIds] = useState<
    string[]
  >(getParam("collectionsIds"));
  const [filtering, setFiltering] = useState<GetUserItemsFilterType>(
    getParam("filtering"),
  );
  const [sorting, setSorting] = useState<GetUserItemsSortType>(
    getParam("sorting"),
  );
  const [viewMode, setViewMode] = useState<"standard" | "tierlist" | "random">(
    getParam("viewMode"),
  );

  useEffect(() => {
    if (
      selectedCollectionsIds.length === 0 &&
      collections.length > 0 &&
      collections[0]
    ) {
      const firstCollectionId = collections[0].id;
      setSelectedCollectionsIds([firstCollectionId]);
      setQueryParams({ collectionsIds: [firstCollectionId] });
    }
  }, [collections, selectedCollectionsIds.length, setQueryParams]);

  const debouncedCollectionsIds = useDebounce(selectedCollectionsIds);

  const { stats, isLoading: isStatsLoading } =
    useGetPublicUserItemsStats(debouncedCollectionsIds);

  const handleClearFilters = () => {
    setFiltering([]);
    setQueryParams({ filtering: [] });
  };

  const handleViewModeChange = (mode: "standard" | "tierlist" | "random") => {
    setViewMode(mode);
    setQueryParams({ viewMode: mode });
  };

  const backgroundImage = useMemo(() => {
    switch (viewMode) {
      case "standard":
        return "/posters9-bg.webp";
      case "tierlist":
        return "/posters8-bg.webp";
      case "random":
        return "/posters10-bg.webp";
      default:
        return "/posters10-bg.webp";
    }
  }, [viewMode]);

  const commonViewProps = {
    collections,
    collectionsIds: debouncedCollectionsIds,
    selectedCollectionsIds,
    setSelectedCollectionsIds,
    filtering,
    setFiltering,
    sorting,
    setSorting,
    handleClearFilters,
    viewMode,
    onViewModeChange: handleViewModeChange,
  };

  return (
    <BackgroundImage image={backgroundImage}>
      <Container className="max-w-screen-2xl">
        <div className="flex flex-col gap-4">
          <PublicUserHeader
            user={user}
            stats={stats}
            isStatsLoading={isStatsLoading}
          />

          {viewMode === "standard" && <PublicStandardView {...commonViewProps} />}
          {viewMode === "tierlist" && <PublicTierListView {...commonViewProps} />}
          {viewMode === "random" && <PublicRandomView {...commonViewProps} />}
        </div>
      </Container>
    </BackgroundImage>
  );
}
