"use client";

import { type Dispatch, type SetStateAction } from "react";
import type { SearchResultType } from "../../server/api/modules/parse/types";
import { ItemStatus } from "@prisma/client";
import { api } from "../../trpc/react";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { invalidateItemQueries } from "../../lib/cache-invalidation";

const formSchema = z.object({
  commentTitle: z.string().min(1).max(255).nullable().optional(),
  commentDescription: z.string().min(1).max(1000).nullable().optional(),
  rate: z.number().int().min(0).max(10),
  status: z.nativeEnum(ItemStatus),
  tagsIds: z.array(z.string().cuid()),
  selectedImageUrl: z.string().url().optional().or(z.literal("")),
});

type formDataType = z.infer<typeof formSchema>;

type Props = {
  selectedItem: SearchResultType | null;
  selectedImageFile: File | null;
  selectedCollectionId: string;
  setSelectedItem: Dispatch<SetStateAction<SearchResultType | null>>;
  setSearchResults: Dispatch<SetStateAction<SearchResultType[]>>;
};

export const useAddItemToCollection = (props: Props) => {
  const {
    selectedCollectionId,
    selectedItem,
    selectedImageFile,
    setSelectedItem,
    setSearchResults,
  } = props;

  const { mutateAsync } = api.item.addToCollection.useMutation();

  const form = useForm<formDataType>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: {
      commentTitle: null,
      commentDescription: null,
      rate: 0,
      status: ItemStatus.NOTSTARTED,
      tagsIds: [],
    },
  });

  const utils = api.useUtils();

  const convertToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read cover image"));
    });

  const submit = async (data: formDataType) => {
    if (!selectedItem) return;

    if (selectedItem.id) {
      toast.error(`${selectedItem.title} is already in your collection!`);
      setSelectedItem(null);
      return;
    }

    const {
      commentTitle,
      commentDescription,
      rate,
      status,
      tagsIds,
      selectedImageUrl,
    } = data;
    const formData = {
      status,
      rate,
      collectionId: selectedCollectionId,
      tagsIds: tagsIds,
      provider: selectedItem.provider,
      externalId: selectedItem.externalId,
      mediaKind: selectedItem.mediaKind,
      selectedImageUrl:
        selectedImageUrl ||
        (selectedItem.importable !== false ? selectedItem.image : undefined) ||
        undefined,
      selectedImageBase64: selectedImageFile
        ? await convertToBase64(selectedImageFile)
        : undefined,
      ...((commentTitle || commentDescription) && {
        comment: {
          title: commentTitle,
          description: commentDescription,
        },
      }),
    };

    // Optimistically mark item as added in search results
    setSearchResults((prev) =>
      prev.map((item) =>
        item.resultKey === selectedItem.resultKey
          ? { ...item, id: "temp-id" }
          : item,
      ),
    );

    const promise = mutateAsync(formData, {
      onSuccess: () => {
        void invalidateItemQueries(utils, {
          collectionsIds: [selectedCollectionId],
          includeStats: true,
        });

        setSearchResults((prev) =>
          prev.filter(
            (searchResult) => searchResult.resultKey !== selectedItem.resultKey,
          ),
        );
      },
      onError: () => {
        setSearchResults((prev) =>
          prev.map((item) =>
            item.resultKey === selectedItem.resultKey
              ? { ...item, id: null }
              : item,
          ),
        );
      },
    });

    setSelectedItem(null);
    form.reset();

    toast.promise(promise, {
      loading: `Adding ${selectedItem.title}...`,
      success: `${selectedItem.title} added successfully!`,
      error: (error) => `Failed to add ${selectedItem.title}: ${error.message}`,
    });
  };

  return {
    form,
    submit,
  };
};
