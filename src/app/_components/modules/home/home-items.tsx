import React from "react";
import type { ItemType } from "../../../../server/api/modules/item/types";
import Link from "next/link";
import { HomeLargeItem, HomeMediumItem, HomeEditItem } from "./items-sizes";
import type { ItemSize } from "./home-items-size-tabs";
import type { TagType } from "../../../../server/api/modules/tag/types";

type HomeItemSize = ItemSize | "edit";

type Props = {
  itemSize: HomeItemSize;
  items: ItemType[];
  tags: TagType[];
  selectedCollectionsIds: string[];
};

const HomeItems = (props: Props) => {
  const { itemSize, items, selectedCollectionsIds, tags } = props;

  return (
    <>
      {itemSize === "large" && (
        <div className="mx-auto grid grid-cols-1 gap-x-4 gap-y-6 xl:grid-cols-2">
          {items.map((item) => (
            <Link key={item.id} href={`/item/${item.id}`}>
              <HomeLargeItem
                key={item.id}
                item={item}
                selectedCollectionsIds={selectedCollectionsIds}
              />
            </Link>
          ))}
        </div>
      )}
      {itemSize === "medium" && (
        <div className="mx-auto grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((item) => (
            <Link key={item.id} href={`/item/${item.id}`}>
              <HomeMediumItem key={item.id} item={item} />
            </Link>
          ))}
        </div>
      )}
      {itemSize === "edit" && (
        <div className="mx-auto grid w-full grid-cols-1 gap-4 xl:grid-cols-2">
          {items.map((item) => (
            <HomeEditItem
              key={item.id}
              item={item}
              tags={tags}
              selectedCollectionsIds={selectedCollectionsIds}
            />
          ))}
        </div>
      )}
    </>
  );
};

export { HomeItems };
