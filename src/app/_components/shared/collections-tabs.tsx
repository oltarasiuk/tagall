import React, {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { CollectionType } from "../../../server/api/modules/collection/types";
import { GrainCardContainer } from "./grain-card-container";
import { Button } from "../ui";

type Props = {
  collections: CollectionType[];
  selectedCollectionsIds: string[];
  setSelectedCollectionsIds: Dispatch<SetStateAction<string[]>>;
  isMany?: boolean;
  clear?: () => void;
  allowDeselect?: boolean;
  actions?: ReactNode;
};

export const CollectionsTabs = (props: Props) => {
  const {
    collections,
    selectedCollectionsIds,
    setSelectedCollectionsIds,
    isMany = true,
    clear,
    allowDeselect = true,
    actions,
  } = props;

  const onClick = (collectionId: string) => {
    if (clear) clear();
    if (isMany) {
      setSelectedCollectionsIds((prev) => {
        if (prev.includes(collectionId)) {
          return prev.filter((id) => id !== collectionId);
        }
        return [...prev, collectionId];
      });
    } else {
      setSelectedCollectionsIds((prev) => {
        if (!allowDeselect && prev.includes(collectionId)) {
          return prev;
        }
        if (prev.includes(collectionId)) {
          return [];
        }
        return [collectionId];
      });
    }
  };

  return (
    <div className="w-fit max-w-full">
      <GrainCardContainer className="flex-wrap items-center">
        {collections.map((collection) => (
          <Button
            key={collection.id}
            onClick={() => onClick(collection.id)}
            variant={
              selectedCollectionsIds.includes(collection.id)
                ? "default"
                : "ghost"
            }
            className="transition-all duration-300 hover:scale-110"
          >
            {collection.name}
          </Button>
        ))}
        {actions}
      </GrainCardContainer>
    </div>
  );
};
