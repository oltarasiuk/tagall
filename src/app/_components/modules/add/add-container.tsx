"use client";
import { useState } from "react";
import { AddSearchResultItem } from "./add-search-result-item";
import { AddItemModal } from "./add-item-modal";
import type {
  SearchResultType,
  SearchMediaFilterType,
} from "../../../../server/api/modules/parse/types";
import Link from "next/link";
import { CollectionsTabs, Container, Loading, ScrollButton, Search } from "../../shared";
import {
  useDebouncedQueryParams,
  useGetUserTags,
  useQueryParams,
  useSearchItems,
} from "../../../../hooks";
import { api } from "../../../../trpc/react";
import type { z } from "zod";
import { SearchInputSchema } from "../../../../server/api/modules/parse/schemas";
import type { CollectionType } from "../../../../server/api/modules/collection/types";

export const AddParamsSchema = SearchInputSchema.pick({
  query: true,
});

export type AddParamsType = z.infer<typeof AddParamsSchema>;

const SEARCH_ALL_COLLECTION_ID = "all" as const;

const MEDIA_FILTER_OPTIONS: SearchMediaFilterType[] = ["Film", "Serie", "Manga"];

const MEDIA_FILTER_COLLECTIONS: CollectionType[] = MEDIA_FILTER_OPTIONS.map(
  (type) => ({
    id: type,
    name: type,
    slug: type.toLowerCase(),
    priority: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
);

function AddContainer() {
  const [collections] = api.collection.getAll.useSuspenseQuery();

  const { getParam, setQueryParams } = useQueryParams<AddParamsType>({
    schema: AddParamsSchema,
    defaultParams: { query: "" },
  });

  const [query, setQuery] = useState(getParam("query"));
  const [searchResults, setSearchResults] = useState<SearchResultType[]>([]);
  const [selectedItem, setSelectedItem] = useState<SearchResultType | null>(
    null,
  );
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);

  useDebouncedQueryParams<AddParamsType>({ query }, setQueryParams);

  const { tags } = useGetUserTags({
    collectionsIds: selectedItem?.suggestedCollectionId
      ? [selectedItem.suggestedCollectionId]
      : collections.map((c) => c.id),
  });

  const { isLoading, submit: baseSubmit } = useSearchItems({
    query,
    selectedCollectionId: SEARCH_ALL_COLLECTION_ID,
    setSearchResults,
    setSelectedItem,
  });

  const submit = () => {
    setSelectedMediaIds([]);
    baseSubmit();
  };

  const filteredResults = [
    ...(selectedMediaIds.length === 0
      ? searchResults
      : searchResults.filter(
          (r) => (r.suggestedCollectionName ?? "Film") === selectedMediaIds[0],
        )),
  ]
    .filter((r) => !!r.image)
    .sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));

  const hasResults = searchResults.length > 0;

  return (
    <Container>
      <Search
        autoFocus
        isLoading={isLoading}
        query={query}
        setQuery={setQuery}
        submit={submit}
      />

      {hasResults && !isLoading && (
        <CollectionsTabs
          collections={MEDIA_FILTER_COLLECTIONS}
          selectedCollectionsIds={selectedMediaIds}
          setSelectedCollectionsIds={setSelectedMediaIds}
          isMany={false}
        />
      )}

      {selectedItem && (
        <AddItemModal
          tags={tags}
          selectedItem={selectedItem}
          open={!!selectedItem}
          selectedCollectionId={
            selectedItem.suggestedCollectionId ?? collections[0]?.id ?? ""
          }
          setSelectedItem={setSelectedItem}
          setSearchResults={setSearchResults}
        />
      )}

      {!isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {filteredResults.map((searchResult) =>
            searchResult.id ? (
              <Link
                key={searchResult.parsedId}
                href={`/item/${searchResult.id}`}
              >
                <AddSearchResultItem
                  searchResult={searchResult}
                  setSelectedItem={setSelectedItem}
                />
              </Link>
            ) : (
              <AddSearchResultItem
                key={searchResult.parsedId}
                searchResult={searchResult}
                setSelectedItem={setSelectedItem}
              />
            ),
          )}
        </div>
      ) : (
        <Loading />
      )}

      <ScrollButton />
    </Container>
  );
}
export { AddContainer };
