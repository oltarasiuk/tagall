"use client";
import {
  AutosizeTextarea,
  Button,
  DualRangeSlider,
  Input,
  ResponsiveModal,
  ResponsiveModalContent,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../ui";
import type { Dispatch, SetStateAction } from "react";
import {
  RATING_NAMES,
  STATUS_ICONS,
  STATUS_NAMES,
  STATUS_VALUES,
} from "../../../../constants";
import type { SearchResultType } from "../../../../server/api/modules/parse/types";
import type { TagType } from "../../../../server/api/modules/tag/types";
import { useAddItemToCollection } from "../../../../hooks";
import { AddSearchResultItem } from "./add-search-result-item";
import { useState } from "react";

type Props = {
  open: boolean;
  tags: TagType[];
  selectedItem: SearchResultType;
  selectedCollectionId: string;
  setSelectedItem: Dispatch<SetStateAction<SearchResultType | null>>;
  setSearchResults: Dispatch<SetStateAction<SearchResultType[]>>;
};

const AddItemModal = (props: Props) => {
  const { selectedItem, open, setSelectedItem, tags } = props;
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const { form, submit } = useAddItemToCollection({
    ...props,
    selectedImageFile,
  });

  const status = form.watch("status");
  const rating = form.watch("rate");
  const tagsIds = form.watch("tagsIds");
  const selectedImageUrl = form.watch("selectedImageUrl");
  const needsCoverInput =
    !selectedItem.image || selectedItem.importable === false;
  const hasCover = Boolean(
    (!needsCoverInput && selectedItem.image) ||
    selectedImageUrl ||
    selectedImageFile,
  );

  // no-op: card is not clickable inside the modal
  const noop: Dispatch<SetStateAction<SearchResultType | null>> = () =>
    undefined;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(open) => {
        if (!open) setSelectedItem(null);
      }}
    >
      <ResponsiveModalContent className="h-min min-h-64 sm:max-w-2xl md:max-w-3xl lg:max-w-4xl">
        <div className="flex flex-col gap-4 p-4">
          {/* Title — visible only on mobile */}
          <h3 className="text-lg font-bold leading-tight sm:hidden">
            {selectedItem.title}
          </h3>

          {/* Card preview — hidden on mobile */}
          <div className="hidden sm:block">
            <AddSearchResultItem
              searchResult={selectedItem}
              setSelectedItem={noop}
              disableHover
            />
          </div>

          {/* Form */}
          <div className="w-full">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(submit)}
                className="flex w-full flex-col gap-5"
              >
                {/* Status + Rating — side by side on desktop */}
                <div className="flex flex-col gap-5 sm:flex-row sm:items-stretch sm:gap-6">
                  {/* Status */}
                  <div className="flex-shrink-0">
                    <FormField
                      control={form.control}
                      name="status"
                      render={() => (
                        <FormItem className="h-full">
                          <div className="flex h-full flex-col justify-between gap-2">
                            <div className="flex items-center justify-between gap-4">
                              <FormLabel>Status</FormLabel>
                              <span className="text-base text-muted-foreground">
                                {STATUS_NAMES[status]}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              {STATUS_VALUES.map((s) => {
                                const IconComponent = STATUS_ICONS[s];
                                return (
                                  <FormControl key={s}>
                                    <Button
                                      size="icon"
                                      variant={
                                        status === s ? "default" : "secondary"
                                      }
                                      onClick={(e) => {
                                        e.preventDefault();
                                        form.setValue("status", s);
                                      }}
                                    >
                                      <IconComponent size={16} />
                                    </Button>
                                  </FormControl>
                                );
                              })}
                            </div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Rating */}
                  <div className="min-w-0 flex-1">
                    <FormField
                      control={form.control}
                      name="rate"
                      render={() => (
                        <FormItem className="h-full">
                          <div className="flex h-full flex-col justify-between gap-2">
                            <div className="flex items-center justify-between">
                              <FormLabel>Your Rating</FormLabel>
                              <span className="text-base text-muted-foreground">
                                {rating > 0 ? (
                                  <span className="font-semibold text-foreground">
                                    {rating}
                                  </span>
                                ) : null}{" "}
                                {RATING_NAMES[rating]}
                              </span>
                            </div>
                            <DualRangeSlider
                              value={[rating]}
                              onValueChange={(value) =>
                                form.setValue("rate", value[0] ?? 0)
                              }
                              className="mb-4"
                              min={0}
                              max={10}
                              step={1}
                            />
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Tags */}
                {tags.length > 0 && (
                  <FormField
                    control={form.control}
                    name="tagsIds"
                    render={() => (
                      <FormItem>
                        <div className="space-y-2">
                          <FormLabel>Tags</FormLabel>
                          <div className="flex flex-wrap gap-2">
                            {tags.map((tag) => (
                              <FormControl key={tag.id}>
                                <Button
                                  size="sm"
                                  variant={
                                    tagsIds?.find((c) => c === tag.id)
                                      ? "default"
                                      : "secondary"
                                  }
                                  onClick={(e) => {
                                    e.preventDefault();
                                    form.setValue(
                                      "tagsIds",
                                      tagsIds.includes(tag.id)
                                        ? tagsIds.filter((c) => c !== tag.id)
                                        : [...tagsIds, tag.id],
                                    );
                                  }}
                                >
                                  {tag.name}
                                </Button>
                              </FormControl>
                            ))}
                          </div>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Comment title */}
                {needsCoverInput && (
                  <>
                    <FormField
                      control={form.control}
                      name="selectedImageUrl"
                      render={() => (
                        <FormItem>
                          <FormLabel>Cover URL</FormLabel>
                          <FormControl>
                            <Input
                              type="url"
                              placeholder="https://…"
                              value={selectedImageUrl ?? ""}
                              onChange={(event) =>
                                form.setValue(
                                  "selectedImageUrl",
                                  event.target.value,
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormItem>
                      <FormLabel>Or upload a cover</FormLabel>
                      <Input
                        type="file"
                        accept="image/*,.png,.jpg,.jpeg,.gif,.webp"
                        onChange={(event) =>
                          setSelectedImageFile(event.target.files?.[0] ?? null)
                        }
                      />
                    </FormItem>
                  </>
                )}
                <FormField
                  control={form.control}
                  name="commentTitle"
                  render={() => (
                    <FormItem>
                      <div className="space-y-2">
                        <FormLabel>Comment Title</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Season 1, Vol. 1–3…"
                            max={255}
                            onChange={(e) =>
                              form.setValue(
                                "commentTitle",
                                e.target.value ? e.target.value : null,
                              )
                            }
                            value={form.watch("commentTitle") ?? ""}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Comment description */}
                <FormField
                  control={form.control}
                  name="commentDescription"
                  render={() => (
                    <FormItem>
                      <div className="space-y-2">
                        <FormLabel>Comment</FormLabel>
                        <FormControl>
                          <AutosizeTextarea
                            placeholder="Your thoughts…"
                            maxHeight={160}
                            maxLength={1000}
                            onChange={(e) =>
                              form.setValue(
                                "commentDescription",
                                e.target.value ? e.target.value : null,
                              )
                            }
                            value={form.watch("commentDescription") ?? ""}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  className="w-full"
                  disabled={form.formState.isSubmitting || !hasCover}
                  type="submit"
                >
                  Add to collection
                </Button>
              </form>
            </Form>
          </div>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

export { AddItemModal };
