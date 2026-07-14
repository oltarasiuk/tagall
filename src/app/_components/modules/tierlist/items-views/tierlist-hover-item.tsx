"use client";

import type { TierItemType } from "../../../../../server/api/modules/item/types";
import { CloudinaryImage, ItemTypeBadge } from "../../../shared";

type Props = {
  item: TierItemType;
};

const TierListHoverItem = (props: Props) => {
  const { item } = props;

  return (
    <div className="group relative h-[120px] w-[80px] flex-shrink-0 cursor-pointer overflow-hidden rounded-sm">
      {/* Base image */}
      {item.image ? (
        <CloudinaryImage
          publicId={item.image}
          folder={item.collection.name}
          className="!h-[120px] !w-[80px] rounded-sm object-cover transition-all group-hover:blur-sm group-hover:scale-110"
        />
      ) : (
        <div className="h-[120px] w-[80px] rounded-sm bg-primary transition-all group-hover:blur-sm" />
      )}
      
      {/* Hover overlay with title and year */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40 p-2 opacity-0 transition-opacity group-hover:opacity-100">
        <p className="text-center text-xs font-semibold text-white line-clamp-3">
          {item.title}
        </p>
        {item.year && (
          <p className="text-xs text-white/80">{item.year}</p>
        )}
        <ItemTypeBadge collectionName={item.collection.name} className="text-[10px]" />
      </div>
    </div>
  );
};

export { TierListHoverItem };
