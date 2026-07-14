"use client";

import { type Dispatch, type SetStateAction, useEffect } from "react";
import { api } from "../../trpc/react";
import { toast } from "sonner";
import type { SearchResultType } from "../../server/api/modules/parse/types";
import { DEFAULT_ADD_LIMIT } from "../../constants";

type Props = {
  query: string;
  selectedCollectionId: string;
  setSearchResults: Dispatch<SetStateAction<SearchResultType[]>>;
  setSelectedItem: Dispatch<SetStateAction<SearchResultType | null>>;
};
export const useSearchItems = (props: Props) => {
  const { query, selectedCollectionId, setSelectedItem, setSearchResults } =
    props;

  const { data, isFetching, isError, refetch } = api.parse.search.useQuery(
    {
      collectionId: selectedCollectionId,
      query: query.toLowerCase().trim(),
      limit: DEFAULT_ADD_LIMIT,
    },
    { enabled: false },
  );

  const submit = () => {
    const normalizedQuery = query.trim();
    if (!isFetching && normalizedQuery.length >= 1) {
      setSelectedItem(null);
      void refetch();
    }
  };

  useEffect(() => {
    if (isError) {
      toast.error("Failed to fetch search results");
    }
  }, [isError]);

  useEffect(() => {
    if (data) {
      setSearchResults(data);
    }
  }, [data, setSearchResults]);

  return {
    submit,
    isLoading: isFetching,
  };
};
