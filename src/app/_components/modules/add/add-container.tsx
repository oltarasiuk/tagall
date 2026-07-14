"use client";
import { useEffect, useState } from "react";
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
import { Button } from "../../ui";
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
  const [selectedCollectionId, setSelectedCollectionId] = useState("all");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [limit, setLimit] = useState(10);

  useDebouncedQueryParams<AddParamsType>({ query }, setQueryParams);

  const { tags } = useGetUserTags({
    collectionsIds: selectedItem?.suggestedCollectionId
      ? [selectedItem.suggestedCollectionId]
      : collections.map((c) => c.id),
  });

  const { isLoading, submit: baseSubmit } = useSearchItems({
    query,
    selectedCollectionId,
    limit,
    setSearchResults,
    setSelectedItem,
  });

  const submit = () => {
    setLimit(10);
    setHasSubmitted(true);
  };

  useEffect(() => {
    if (hasSubmitted) baseSubmit();
    // A selected tab changes the server request, never a client-side filter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCollectionId, limit]);

  return (
    <Container>
      <div className="w-min">
        <CollectionsTabs
          collections={collections}
          selectedCollectionsIds={
            selectedCollectionId === "all" ? [] : [selectedCollectionId]
          }
          setSelectedCollectionsIds={(value) => {
            const current =
              selectedCollectionId === "all" ? [] : [selectedCollectionId];
            const ids = typeof value === "function" ? value(current) : value;
            const next = ids[0] ?? "all";
            setSelectedCollectionId(next);
          }}
          isMany={false}
        />
      </div>

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
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            {searchResults.map((searchResult) =>
            searchResult.id ? (
              <Link
                key={searchResult.resultKey}
                href={`/item/${searchResult.id}`}
              >
                <AddSearchResultItem
                  searchResult={searchResult}
                  setSelectedItem={setSelectedItem}
                />
              </Link>
            ) : (
              <AddSearchResultItem
                key={searchResult.resultKey}
                searchResult={searchResult}
                setSelectedItem={setSelectedItem}
              />
            ),
            )}
          </div>
          {hasSubmitted && searchResults.length >= limit && (
            <div className="mt-6 flex justify-center">
              <Button
                variant="secondary"
                onClick={() => setLimit((current) => Math.min(current + 10, 30))}
                disabled={limit >= 30}
              >
                Load more
              </Button>
            </div>
          )}
        </>
      ) : (
        <Loading />
      )}

      <ScrollButton />
    </Container>
  );
}
export { AddContainer };
