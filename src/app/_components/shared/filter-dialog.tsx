import React, { type Dispatch, type SetStateAction } from "react";
import {
  Button,
  DualRangeSlider,
  Header,
  Input,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTrigger,
} from "../ui";
import { STATUS_NAMES, STATUS_VALUES } from "../../../constants";
import { Search, SlidersHorizontal } from "lucide-react";
import type { GetUserItemsFilterType } from "../../../server/api/modules/item/types";
import type { ItemStatus } from "@prisma/client";
import type { TagType } from "../../../server/api/modules/tag/types/tag.type";
import type { FilterFieldsType } from "../../../server/api/modules/field/types";
import { GrainCardContainer } from "./grain-card-container";
import { capitalize } from "../../../lib";

type Props = {
  searchFilter: string;
  tags: TagType[];
  setSearchFilter: Dispatch<SetStateAction<string>>;
  fieldGroups: FilterFieldsType[];
  yearsRange: {
    minYear: number;
    maxYear: number;
  };
  filterRates: number[];
  setFilterRates: Dispatch<SetStateAction<number[]>>;
  filterYears: number[];
  setFilterYears: Dispatch<SetStateAction<number[]>>;
  filtering: GetUserItemsFilterType;
  setFiltering: Dispatch<SetStateAction<GetUserItemsFilterType>>;
};

export const FilterDialog = (props: Props) => {
  const {
    tags,
    yearsRange,
    fieldGroups,
    filterRates,
    filterYears,
    filtering,
    setFilterRates,
    setFilterYears,
    setFiltering,
    searchFilter,
    setSearchFilter,
  } = props;

  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(searchFilter.toLowerCase()),
  );

  const filteredStatuses = STATUS_VALUES.map(
    (status) => [status, STATUS_NAMES[status]] as const,
  ).filter(([_, name]) =>
    name.toLowerCase().includes(searchFilter.toLowerCase()),
  );

  const filteredFieldGroups = fieldGroups
    .map((fieldGroup) => ({
      ...fieldGroup,
      fields: fieldGroup.fields.filter((field) =>
        field.value.toLowerCase().includes(searchFilter.toLowerCase()),
      ),
    }))
    .filter(
      (fieldGroup) =>
        fieldGroup.fields.length > 0 &&
        (searchFilter.trim().length > 0 ||
          !["people", "studios"].includes(fieldGroup.name.toLowerCase())),
    );

  const onClickStatus = (status: ItemStatus) => {
    setFiltering((prev) => {
      const updatedFiltering = prev.filter(
        (f) => f.name !== "status" || f.value !== status,
      );
      const selectedFilter = prev.find(
        (f) => f.name === "status" && f.value === status,
      );
      if (!selectedFilter) {
        updatedFiltering.push({
          name: "status",
          type: "include",
          value: status,
        });
      } else if (selectedFilter.type === "include") {
        updatedFiltering.push({
          name: "status",
          type: "exclude",
          value: status,
        });
      }
      return updatedFiltering;
    });
  };

  const onClickTags = (tagId: string, tagValue: string) => {
    setFiltering((prev) => {
      const updatedFiltering = prev.filter(
        (f) => f.name !== "tag" || f.tagId !== tagId,
      );
      const selectedFilter = prev.find(
        (f) => f.name === "tag" && f.tagId === tagId,
      );
      if (!selectedFilter) {
        updatedFiltering.push({
          name: "tag",
          type: "include",
          value: tagValue,
          tagId: tagId,
        });
      } else if (selectedFilter.type === "include") {
        updatedFiltering.push({
          name: "tag",
          type: "exclude",
          value: tagValue,
          tagId: tagId,
        });
      }
      return updatedFiltering;
    });
  };

  const onClickField = (fieldId: string, fieldValue: string) => {
    setFiltering((prev) => {
      const updatedFiltering = prev.filter(
        (f) => f.name !== "field" || f.value !== fieldValue,
      );
      const selectedFilter = prev.find(
        (f) => f.name === "field" && f.value === fieldValue,
      );
      if (!selectedFilter) {
        updatedFiltering.push({
          name: "field",
          type: "include",
          value: fieldValue,
          fieldId: fieldId,
        });
      } else if (selectedFilter.type === "include") {
        updatedFiltering.push({
          name: "field",
          type: "exclude",
          value: fieldValue,
          fieldId: fieldId,
        });
      }
      return updatedFiltering;
    });
  };

  return (
    <>
      <ResponsiveModal>
        <ResponsiveModalTrigger asChild>
          <GrainCardContainer>
            <div className="w-min">
              <Button size={"icon"} variant={"ghost"} className="aspect-square">
                <SlidersHorizontal />
              </Button>
            </div>
          </GrainCardContainer>
        </ResponsiveModalTrigger>
        <ResponsiveModalContent className="sm:max-w-2xl md:max-w-2xl lg:max-w-3xl [&>button]:hidden">
          <div className="flex max-h-[400px] w-full flex-col gap-8 rounded-sm bg-transparent p-4 md:max-h-[700px]">
            <div className="flex items-center justify-between">
              <Header vtag="h4">Filter</Header>
              <Button
                onClick={() => {
                  setFiltering([]);
                  setSearchFilter("");
                }}
              >
                Clear
              </Button>
            </div>
            <div className="relative">
              <Input
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-lg border border-zinc-300 px-4 py-2 pr-10 focus:border-primary focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />

              <Search className="absolute right-3 top-1/2 z-30 h-5 w-5 -translate-y-1/2 cursor-pointer text-zinc-400 dark:text-zinc-500" />
            </div>
            {!searchFilter && (
              <div className="flex flex-col gap-4">
                <Header vtag="h6">Years</Header>
                <div className="px-6 pb-8">
                  <DualRangeSlider
                    label={(value) => value}
                    labelPosition="bottom"
                    value={filterYears}
                    onValueChange={setFilterYears}
                    min={yearsRange.minYear}
                    max={yearsRange.maxYear}
                    step={1}
                  />
                </div>
              </div>
            )}
            {!searchFilter && (
              <div className="flex flex-col gap-4">
                <Header vtag="h6">Rate</Header>
                <div className="px-6 pb-8">
                  <DualRangeSlider
                    label={(value) => value}
                    labelPosition="bottom"
                    value={filterRates}
                    onValueChange={setFilterRates}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>
              </div>
            )}
            {filteredStatuses.length > 0 && (
              <div className="flex flex-col gap-2">
                <Header vtag="h6">Status</Header>
                <div className="flex flex-wrap gap-2">
                  {filteredStatuses.map(([status, name]) => {
                    const typedStatus = status as ItemStatus;
                    const statusFilter = filtering.find(
                      (f) => f.name === "status" && f.value === typedStatus,
                    );
                    return (
                      <Button
                        key={typedStatus}
                        variant={
                          statusFilter?.type === "include"
                            ? "default"
                            : statusFilter?.type === "exclude"
                              ? "destructive"
                              : "ghost"
                        }
                        size={"sm"}
                        onClick={() => onClickStatus(typedStatus)}
                      >
                        {name}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            {filteredTags.length > 0 && (
              <div className="flex flex-col gap-2">
                <Header vtag="h6">Tags</Header>
                <div className="flex flex-wrap gap-2">
                  {filteredTags.map((tag) => {
                    const tagFilter = filtering.find(
                      (f) => f.name === "tag" && f.tagId === tag.id,
                    );
                    return (
                      <Button
                        key={tag.id}
                        variant={
                          tagFilter?.type === "include"
                            ? "default"
                            : tagFilter?.type === "exclude"
                              ? "destructive"
                              : "ghost"
                        }
                        size={"sm"}
                        onClick={() => onClickTags(tag.id, tag.name)}
                      >
                        {capitalize(tag.name)}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            {filteredFieldGroups.map((fieldGroup) => (
              <div key={fieldGroup.id} className="flex flex-col gap-2">
                <Header vtag="h6">{capitalize(fieldGroup.name)}</Header>
                <div className="flex flex-wrap gap-2">
                  {fieldGroup.fields.map((field) => {
                    const fieldFilter = filtering.find(
                      (f) => f.name === "field" && f.value === field.value,
                    );
                    return (
                      <Button
                        key={field.id}
                        variant={
                          fieldFilter?.type === "include"
                            ? "default"
                            : fieldFilter?.type === "exclude"
                              ? "destructive"
                              : "ghost"
                        }
                        size={"sm"}
                        onClick={() => onClickField(field.id, field.value)}
                      >
                        {capitalize(field.value)}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
};
