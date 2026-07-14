"use client";
import { useState } from "react";
import { AddSearchResultItem } from "./add-search-result-item";
import { AddItemModal } from "./add-item-modal";
import type { SearchResultType } from "../../../../server/api/modules/parse/types";
import Link from "next/link";
import {
  CollectionsTabs,
  Container,
  Loading,
  ScrollButton,
  Search,
} from "../../shared";
import {
  useDebouncedQueryParams,
  useGetUserTags,
  useQueryParams,
  useSearchItems,
} from "../../../../hooks";
import { api } from "../../../../trpc/react";
import type { z } from "zod";
import { SearchInputSchema } from "../../../../server/api/modules/parse/schemas";

export const AddParamsSchema = SearchInputSchema.pick({
  query: true,
});

export type AddParamsType = z.infer<typeof AddParamsSchema>;

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
    selectedCollectionIds: selectedMediaIds,
    setSearchResults,
    setSelectedItem,
  });

  const submit = () => {
    baseSubmit();
  };

  // Tabs come from the collections themselves, so a new one (Book, Comic, ...)
  // is filterable the moment it is seeded. Results carry the collection the
  // provider suggested, so the filter compares ids, not display names.
  const filteredResults =
    selectedMediaIds.length === 0
      ? searchResults
      : searchResults.filter(
          (result) =>
            !!result.suggestedCollectionId &&
            selectedMediaIds.includes(result.suggestedCollectionId),
        );

  return (
    <Container>
      <CollectionsTabs
        collections={collections}
        selectedCollectionsIds={selectedMediaIds}
        setSelectedCollectionsIds={setSelectedMediaIds}
      />

      <Search
        autoFocus
        isLoading={isLoading}
        query={query}
        setQuery={setQuery}
        submit={submit}
      />

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
