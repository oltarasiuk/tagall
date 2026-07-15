import { Header } from "../../../ui";
import type { ItemType } from "../../../../../server/api/modules/item/types";
import {
  CardContainer,
  CloudinaryImage,
  ItemExternalRatingBadge,
  ItemRatingBadge,
  ItemStatusBadge,
  ItemTypeBadge,
} from "../../../shared";

type Props = {
  item: ItemType;
};

const HomeMediumItem = (props: Props) => {
  const { item } = props;

  return (
    <CardContainer className="relative h-full flex-col overflow-hidden transition-all duration-300 hover:scale-105 hover:border-primary hover:shadow-md md:w-full">
      {item.image && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <CloudinaryImage
            variant="background"
            className="!aspect-auto h-full w-full rounded-none border-0 object-cover opacity-5 shadow-none blur-sm"
            publicId={item.image}
            folder={item.collection.name}
          />
        </div>
      )}

      <div
        className="pointer-events-none absolute inset-0 z-[1] opacity-[0.035]"
        style={{
          backgroundImage: "url('/halftone.png')",
          backgroundRepeat: "repeat",
        }}
      />

      <div className="relative z-10 aspect-[27/40]">
        {item.image ? (
          <CloudinaryImage
            publicId={item.image}
            folder={item.collection.name}
            className="rounded-xl"
          />
        ) : (
          <div className="aspect-[27/40] rounded-xl bg-primary object-cover" />
        )}
      </div>
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-1 p-2">
        <Header vtag="h6" className="line-clamp-3 text-center">
          {item.title}
        </Header>
        <div className="flex w-full items-center justify-center gap-x-2 gap-y-1">
          <ItemTypeBadge
            collectionName={item.collection.name}
            className="shrink-0 text-xs"
          />
          <div className="flex shrink-0 items-center gap-1.5">
            <ItemStatusBadge
              status={item.status}
              showLabel={false}
              className="text-xs"
            />
            {item.rate != null && (
              <ItemRatingBadge rate={item.rate} className="text-xs" />
            )}
            {item.externalRating != null && (
              <ItemExternalRatingBadge
                rating={item.externalRating}
                className="text-xs text-red-500"
              />
            )}
          </div>
        </div>
      </div>
    </CardContainer>
  );
};

export { HomeMediumItem };
