"use client";

import { useState, useMemo } from "react";
import type {
  GetUserItemsFilterType,
  GetUserItemsSortType,
  TierItemType,
} from "../../../../server/api/modules/item/types";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { TierListItemsViewTabs } from "./tierlist-items-view-tabs";
import { TierListSortSelect } from "./tierlist-sort-select";
import { TierListTierRow } from "./tierlist-tier-row";
import { TierListVirtualizedTierRow } from "./tierlist-virtualized-tier-row";
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
  useGetAllUserItems,
  useGetUserTags,
  useParseFiltering,
  useYearsRange,
  useQueryParams,
  useDebounce,
  useDebouncedQueryParams,
} from "../../../../hooks";
import { z } from "zod";
import { GetAllUserItemsInputSchema } from "../../../../server/api/modules/item/schemas";
import { api } from "../../../../trpc/react";
import type { TierItemView } from "../../../../types/tier-item-view.type";
import { TIER_ROWS } from "../../../../constants";
import { toast } from "sonner";
import { TierListItem } from "./tierlist-item";

export const TierListParamsSchema = GetAllUserItemsInputSchema._def.innerType
  .pick({ collectionsIds: true, filtering: true, sorting: true })
  .extend({
    itemView: z.enum(["poster", "hover", "title"]).optional(),
  })
  .default({});

export type TierListParamsType = z.infer<typeof TierListParamsSchema>;

function TierListContainer() {
  const [collections] = api.collection.getUserCollections.useSuspenseQuery();

  const { getParam, setQueryParams } = useQueryParams<TierListParamsType>({
    schema: TierListParamsSchema,
    defaultParams: {
      filtering: [],
      itemView: "hover",
      sorting: {
        type: "asc",
        name: "title",
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
  const [itemView, setItemView] = useState<TierItemView>(getParam("itemView"));
  const [sorting, setSorting] = useState<GetUserItemsSortType>(
    getParam("sorting"),
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [activeItem, setActiveItem] = useState<TierItemType | null>(null);

  const debouncedSelectedCollectionsIds = useDebounce(selectedCollectionsIds);

  useDebouncedQueryParams<TierListParamsType>(
    {
      collectionsIds: selectedCollectionsIds,
      filtering,
      sorting,
      itemView,
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

  const { tierItemsMap, setTierItemsMap, isLoading } = useGetAllUserItems({
    collectionsIds: debouncedSelectedCollectionsIds,
    sorting,
    filtering,
    searchQuery,
  });

  const { mutateAsync } = api.item.updateItem.useMutation();
  const utils = api.useUtils();

  // Configure sensors for both mouse and touch devices
  const mouseSensor = useSensor(MouseSensor, {
    // Require the mouse to move by 10 pixels before activating
    activationConstraint: {
      distance: 10,
    },
  });

  const touchSensor = useSensor(TouchSensor, {
    // Press delay of 250ms, with tolerance of 5px of movement
    activationConstraint: {
      delay: 250,
      tolerance: 5,
    },
  });

  const sensors = useSensors(mouseSensor, touchSensor);

  const tierRowsComponents = useMemo(
    () =>
      TIER_ROWS.map((rate) => {
        const items = tierItemsMap.get(rate) ?? [];
        const useVirtualization = items.length > 20;

        return useVirtualization ? (
          <TierListVirtualizedTierRow
            key={rate}
            rate={rate}
            items={items}
            itemView={itemView}
          />
        ) : (
          <TierListTierRow
            key={rate}
            rate={rate}
            items={items}
            itemView={itemView}
          />
        );
      }),
    [tierItemsMap, itemView],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const item = event.active.data.current?.item as TierItemType | undefined;
    if (item) {
      setActiveItem(item);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveItem(null);

    const { active, over } = event;

    if (!over) return;

    const itemId = active.id as string;
    const overData = over.data.current;
    const newRate = overData?.rate as number | undefined;

    if (newRate === undefined) return;

    // Find the item in the current tierItemsMap to get fresh data
    let item: TierItemType | undefined;
    for (const [, items] of tierItemsMap) {
      const foundItem = items.find((i) => i.id === itemId);
      if (foundItem) {
        item = foundItem;
        break;
      }
    }

    if (!item) return;

    const oldRate = item.rate ?? 0;

    if (oldRate === newRate) return;

    // Optimistic update: move item between tiers
    setTierItemsMap((prevMap) => {
      const newMap = new Map(prevMap);

      // Remove from old tier
      const oldTierItems = newMap.get(oldRate) ?? [];
      const filteredOldTier = oldTierItems.filter((i) => i.id !== itemId);
      newMap.set(oldRate, filteredOldTier);

      // Add to new tier
      const newTierItems = newMap.get(newRate) ?? [];
      const updatedItem = { ...item, rate: newRate };
      newMap.set(newRate, [...newTierItems, updatedItem]);

      return newMap;
    });

    // Update on server
    const promise = mutateAsync(
      {
        id: itemId,
        rate: newRate,
        status: item.status || "NOTSTARTED",
        tagsIds: [],
      },
      {
        onSuccess: () => {
          utils.item.getAllUserItems.invalidate();
        },
        onError: () => {
          // Rollback on error
          setTierItemsMap((prevMap) => {
            const newMap = new Map(prevMap);

            // Remove from new tier
            const newTierItems = newMap.get(newRate) ?? [];
            const filteredNewTier = newTierItems.filter((i) => i.id !== itemId);
            newMap.set(newRate, filteredNewTier);

            // Add back to old tier
            const oldTierItems = newMap.get(oldRate) ?? [];
            newMap.set(oldRate, [...oldTierItems, item]);

            return newMap;
          });
        },
      },
    );

    toast.promise(promise, {
      loading: `Updating ${item.title}...`,
      success: `${item.title} moved to tier ${newRate}!`,
      error: (error) => `Failed to update ${item.title}: ${error.message}`,
    });
  };

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
        <TierListItemsViewTabs itemView={itemView} setItemView={setItemView} />

        <TierListSortSelect setSorting={setSorting} sorting={sorting} />

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

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loading />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-col gap-4">{tierRowsComponents}</div>

          <DragOverlay>
            {activeItem ? (
              <div className="cursor-grabbing">
                <TierListItem item={activeItem} itemView={itemView} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <ScrollButton />
    </Container>
  );
}

export { TierListContainer };
