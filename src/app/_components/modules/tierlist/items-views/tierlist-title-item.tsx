"use client";

import type { TierItemType } from "../../../../../server/api/modules/item/types";
import { CloudinaryImage, CardContainer, ItemTypeBadge } from "../../../shared";
import { Header } from "../../../ui";

type Props = {
  item: TierItemType;
};

const TierListTitleItem = (props: Props) => {
  const { item } = props;

  return (
    <CardContainer className="flex h-full w-[120px] flex-shrink-0 flex-col gap-2 p-2">
      <div className="h-[160px] w-full">
        {item.image ? (
          <CloudinaryImage
            publicId={item.image}
            folder={item.collection.name}
            className="!h-[160px] !w-full rounded-sm object-cover"
          />
        ) : (
          <div className="h-[160px] w-full rounded-sm bg-primary" />
        )}
      </div>
      <Header vtag="h6" className="line-clamp-2 text-center text-xs">
        {item.title}
      </Header>
      <div className="flex justify-center">
        <ItemTypeBadge collectionName={item.collection.name} className="text-[10px]" />
      </div>
      {item.year && (
        <p className="text-center text-xs text-muted-foreground">{item.year}</p>
      )}
    </CardContainer>
  );
};

export { TierListTitleItem };
