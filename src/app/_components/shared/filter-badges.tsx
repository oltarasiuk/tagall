import React, { type Dispatch, type SetStateAction } from "react";
import { Badge } from "../ui";
import type { GetUserItemsFilterType } from "../../../server/api/modules/item/types";
import { STATUS_NAMES } from "../../../constants";
import { GrainCardContainer } from "./grain-card-container";
import { capitalize } from "../../../lib";

type Props = {
  filtering: GetUserItemsFilterType;
  setFiltering: Dispatch<SetStateAction<GetUserItemsFilterType>>;
};

const FilterBadges = (props: Props) => {
  const { filtering, setFiltering } = props;

  const removeAllFilters = () => {
    setFiltering([]);
  };

  const removeFilter = (filter: GetUserItemsFilterType[number]) => {
    setFiltering((prev) =>
      prev.filter(
        (f) =>
          f.name !== filter.name ||
          f.type !== filter.type ||
          f.value !== filter.value,
      ),
    );
  };

  if (!filtering.length) return null;

  return (
    <GrainCardContainer className="flex-wrap gap-2">
      {filtering.map((filter, index) => {
        let badgeText = "";
        let isRange = false;

        switch (filter.name) {
          case "rate":
          case "year":
            badgeText =
              filter.type === "from"
                ? `> ${filter.value}`
                : `< ${filter.value}`;
            isRange = true;
            break;
          case "status":
            badgeText =
              filter.type === "include"
                ? `+ ${STATUS_NAMES[filter.value].toLowerCase()}`
                : `- ${STATUS_NAMES[filter.value].toLowerCase()}`;
            break;
          case "tag":
          case "field":
            badgeText =
              filter.type === "include"
                ? `+ ${capitalize(filter.value)}`
                : `- ${capitalize(filter.value)}`;
            break;
        }

        if (isRange) {
          return (
            <Badge
              key={index}
              variant="warning"
              className="cursor-pointer px-3 text-sm hover:bg-destructive"
              onClick={() => removeFilter(filter)}
            >
              {badgeText}
            </Badge>
          );
        }

        return (
          <Badge
            key={index}
            className="cursor-pointer px-3 text-sm hover:bg-destructive"
            onClick={() => removeFilter(filter)}
          >
            {badgeText}
          </Badge>
        );
      })}
      <Badge
        variant="destructive"
        className="cursor-pointer px-3 text-sm hover:opacity-80"
        onClick={removeAllFilters}
      >
        Clear
      </Badge>
    </GrainCardContainer>
  );
};

export { FilterBadges };
