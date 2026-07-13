"use client";
import { useState } from "react";
import type {
  GetUserItemsFilterType,
  GetUserItemsSortType,
} from "../../../../server/api/modules/item/types";
import { Header, InfiniteScroll } from "../../ui";
import { HomeItemSizeTabs, type ItemSize } from "./home-items-size-tabs";
import { HomeSortSelect } from "./home-sort-select";
import { HomeItems } from "./home-items";
import {
  Search,
  FilterDialog,
  ScrollButton,
  CollectionsTabs,
  Loading,
  Container,
  NoItemsCard,
  FilterBadges,
} from "../../shared";
import {
  useGetFilterFields,
  useGetUserItems,
  useGetUserTags,
  useParseFiltering,
  useYearsRange,
  useQueryParams,
  useDebounce,
  useDebouncedQueryParams,
} from "../../../../hooks";
import { z } from "zod";
import { GetUserItemsInputSchema } from "../../../../server/api/modules/item/schemas";
import { api } from "../../../../trpc/react";

type HomeItemSize = ItemSize | "edit";

export const HomeParamsSchema = GetUserItemsInputSchema._def.innerType
  .pick({ collectionsIds: true, filtering: true, sorting: true })
  .extend({
    itemSize: z.enum(["medium", "large", "edit"]).optional(),
  })
  .default({});

export type HomeParamsType = z.infer<typeof HomeParamsSchema>;

function HomeContainer() {
  const [collections] = api.collection.getUserCollections.useSuspenseQuery();

  const { getParam, setQueryParams } = useQueryParams<HomeParamsType>({
    schema: HomeParamsSchema,
    defaultParams: {
      filtering: [],
      itemSize: "large",
      sorting: {
        type: "desc",
        name: "date",
      },
      collectionsIds: collections.map((collection) => collection.id),
    },
  });

  const [selectedCollectionsIds, setSelectedCollectionsIds] = useState<
    string[]
  >(getParam("collectionsIds"));
  const [filtering, setFiltering] = useState<GetUserItemsFilterType>(
    getParam("filtering"),
  );
  const [itemSize, setItemSize] = useState<HomeItemSize>(getParam("itemSize"));
  const [sorting, setSorting] = useState<GetUserItemsSortType>(
    getParam("sorting"),
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState("");

  const debouncedSelectedCollectionsIds = useDebounce(selectedCollectionsIds);

  useDebouncedQueryParams<HomeParamsType>(
    {
      collectionsIds: selectedCollectionsIds,
      filtering,
      sorting,
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

  const { groupedItems, setPage, hasMore, isLoading } = useGetUserItems({
    collectionsIds: debouncedSelectedCollectionsIds,
    sorting,
    filtering,
    searchQuery,
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
        <HomeItemSizeTabs
          itemSize={itemSize === "edit" ? "large" : itemSize}
          setItemSize={setItemSize}
        />

        <HomeSortSelect setSorting={setSorting} sorting={sorting} />

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
      </div>

      <Search
        isLoading={isLoading}
        query={searchQuery}
        setQuery={setSearchQuery}
      />

      <FilterBadges filtering={filtering} setFiltering={setFiltering} />
      {groupedItems.map((group, index) => (
        <div
          key={group.groupBy || `group-${index}`}
          className="flex flex-col gap-4"
        >
          {group.groupBy ? <Header vtag="h3">{group.groupBy}</Header> : null}
          <HomeItems
            tags={tags}
            items={group.items}
            itemSize={itemSize}
            selectedCollectionsIds={debouncedSelectedCollectionsIds}
          />
        </div>
      ))}

      <InfiniteScroll
        hasMore={hasMore}
        isLoading={isLoading}
        next={() => setPage((prev) => prev + 1)}
      >
        {hasMore && <Loading />}
      </InfiniteScroll>

      <ScrollButton />
    </Container>
  );
}
export { HomeContainer };
