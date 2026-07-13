"use client";
import { useState } from "react";
import Link from "next/link";
import {
  CollectionsTabs,
  Container,
  FilterBadges,
  FilterDialog,
  Loading,
  NoItemsCard,
  GrainCardContainer,
} from "../../shared";
import { Button, DualRangeSlider, Spinner } from "../../ui";
import { Dices } from "lucide-react";
import {
  useDebounce,
  useDebouncedQueryParams,
  useGetFilterFields,
  useGetRandomUserItems,
  useGetUserTags,
  useParseFiltering,
  useQueryParams,
  useYearsRange,
} from "../../../../hooks";
import { z } from "zod";
import { GetRandomUserItemsInputSchema } from "../../../../server/api/modules/item/schemas";
import { api } from "../../../../trpc/react";
import type { GetUserItemsFilterType } from "../../../../server/api/modules/item/types";
import { DEFAULT_RANDOM_LIMIT } from "../../../../constants";
import { HomeItemSizeTabs, type ItemSize } from "../home/home-items-size-tabs";
import { HomeLargeItem, HomeMediumItem } from "../home/items-sizes";

export const RandomParamsSchema = GetRandomUserItemsInputSchema._def.innerType
  .extend({ itemSize: z.enum(["medium", "large"]).optional() })
  .default({});

export type RandomParamsType = z.infer<typeof RandomParamsSchema>;

function RandomContainer() {
  const [collections] = api.collection.getUserCollections.useSuspenseQuery();

  const { getParam, setQueryParams } = useQueryParams<RandomParamsType>({
    schema: RandomParamsSchema,
    defaultParams: {
      limit: DEFAULT_RANDOM_LIMIT,
      itemSize: "medium",
      filtering: [],
      collectionsIds: collections.map((collection) => collection.id),
    },
  });

  const [limit, setLimit] = useState<number>(getParam("limit"));
  const [itemSize, setItemSize] = useState<ItemSize>(getParam("itemSize"));
  const [filtering, setFiltering] = useState<GetUserItemsFilterType>(
    getParam("filtering"),
  );
  const [selectedCollectionsIds, setSelectedCollectionsIds] = useState<
    string[]
  >(getParam("collectionsIds"));

  const [searchFilter, setSearchFilter] = useState<string>("");

  const debouncedSelectedCollectionsIds = useDebounce(selectedCollectionsIds);

  useDebouncedQueryParams<RandomParamsType>(
    {
      collectionsIds: selectedCollectionsIds,
      filtering,
      itemSize,
    },
    setQueryParams,
  );

  const { tags } = useGetUserTags({
    collectionsIds: debouncedSelectedCollectionsIds,
  });

  const { yearsRange } = useYearsRange({
    collectionsIds: debouncedSelectedCollectionsIds,
  });

  const { fieldGroups } = useGetFilterFields({
    collectionsIds: debouncedSelectedCollectionsIds,
  });

  const {
    setDefaultFilters,
    filterRates,
    filterYears,
    setFilterRates,
    setFilterYears,
  } = useParseFiltering({
    filtering,
    setFiltering,
    yearsRange,
  });

  const { items, refetch, isLoading } = useGetRandomUserItems({
    collectionsIds: selectedCollectionsIds,
    filtering,
    limit,
  });

  if (!collections.length) {
    return (
      <div className="flex h-svh items-center justify-center p-6">
        <NoItemsCard />
      </div>
    );
  }

  return (
    <Container>
      <div className="flex flex-wrap justify-between gap-4">
        <CollectionsTabs
          clear={setDefaultFilters}
          collections={collections}
          selectedCollectionsIds={selectedCollectionsIds}
          setSelectedCollectionsIds={setSelectedCollectionsIds}
        />
        <HomeItemSizeTabs itemSize={itemSize} setItemSize={setItemSize} />

        <GrainCardContainer className="w-64">
          <DualRangeSlider
            value={[limit]}
            onValueChange={(value) => setLimit(value[0] ?? 10)}
            min={1}
            max={20}
            label={(value) => value}
            labelPosition="bottom"
            step={1}
          />
        </GrainCardContainer>

        <FilterDialog
          tags={tags}
          searchFilter={searchFilter}
          setSearchFilter={setSearchFilter}
          filterRates={filterRates}
          setFilterRates={setFilterRates}
          filterYears={filterYears}
          setFilterYears={setFilterYears}
          filtering={filtering}
          setFiltering={setFiltering}
          yearsRange={yearsRange}
          fieldGroups={fieldGroups}
        />
        <GrainCardContainer className="w-32">
          <Button onClick={() => refetch()} className="w-full">
            {isLoading ? (
              <Spinner className="h-5 w-5 text-primary-foreground" />
            ) : (
              <Dices />
            )}
          </Button>
        </GrainCardContainer>
      </div>

      <FilterBadges filtering={filtering} setFiltering={setFiltering} />

      {!isLoading ? (
        itemSize === "large" ? (
          <div className="mx-auto grid grid-cols-1 gap-x-4 gap-y-6 xl:grid-cols-2">
            {items.map((item) => (
              <Link href={`/item/${item.id}`} key={item.id}>
                <HomeLargeItem
                  item={item}
                  selectedCollectionsIds={debouncedSelectedCollectionsIds}
                />
              </Link>
            ))}
          </div>
        ) : (
          <div className="mx-auto grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {items.map((item) => (
              <Link href={`/item/${item.id}`} key={item.id}>
                <HomeMediumItem item={item} />
              </Link>
            ))}
          </div>
        )
      ) : (
        <Loading />
      )}
    </Container>
  );
}
export { RandomContainer };
