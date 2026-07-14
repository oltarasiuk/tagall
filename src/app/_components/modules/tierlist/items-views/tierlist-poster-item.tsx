"use client";

import type { TierItemType } from "../../../../../server/api/modules/item/types";
import { CloudinaryImage, ItemTypeBadge } from "../../../shared";

type Props = {
  item: TierItemType;
};

const TierListPosterItem = (props: Props) => {
  const { item } = props;

  return (
    <div className="relative h-[120px] w-[80px] flex-shrink-0">
      {item.image ? (
        <CloudinaryImage
          publicId={item.image}
          folder={item.collection.name}
          className="!h-[120px] !w-[80px] rounded-sm object-cover"
        />
      ) : (
        <div className="h-[120px] w-[80px] rounded-sm bg-primary" />
      )}
      <ItemTypeBadge
        collectionName={item.collection.name}
        className="absolute bottom-1 left-1 max-w-[calc(100%-0.5rem)] truncate text-[10px] leading-4"
      />
    </div>
  );
};

export { TierListPosterItem };
