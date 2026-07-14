import { Header, Paragraph } from "../../../ui";
import type { ItemType } from "../../../../../server/api/modules/item/types";
import {
  CardContainer,
  CloudinaryImage,
  ItemExternalRatingBadge,
  ItemRatingBadge,
  ItemStatusBadge,
  ItemTypeBadge,
  ItemYearBadge,
} from "../../../shared";

type Props = {
  item: ItemType;
  selectedCollectionsIds: string[];
};

const HomeLargeItem = (props: Props) => {
  const { item } = props;

  return (
    <CardContainer className="relative h-fit cursor-pointer overflow-hidden p-0 transition-all duration-300 hover:scale-105 hover:border-primary hover:shadow-md">
      {/* Blurred background */}
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

      {/* Grain overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-[1] opacity-[0.035]"
        style={{
          backgroundImage: "url('/halftone.png')",
          backgroundRepeat: "repeat",
        }}
      />

      {/* Poster */}
      <div className="relative z-10 aspect-[27/40] w-[110px] flex-shrink-0 sm:w-[150px]">
        {item.image ? (
          <CloudinaryImage
            className="h-full w-full rounded-l-sm object-cover"
            publicId={item.image}
            folder={item.collection.name}
          />
        ) : (
          <div className="h-full w-full rounded-l-sm bg-muted" />
        )}
      </div>

      {/* Content */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-between gap-2 px-4 py-3">
        {/* Title + type badge */}
        <div className="flex items-start justify-between gap-2">
          <Header vtag="h5" className="line-clamp-2 leading-snug">
            {item.title}
          </Header>
          <ItemTypeBadge collectionName={item.collection.name} />
        </div>

        {/* Description */}
        {item.description && (
          <Paragraph
            vsize="sm"
            className="line-clamp-3 leading-relaxed text-muted-foreground"
          >
            {item.description}
          </Paragraph>
        )}

        {/* Bottom row: status · ★ rating · external rating · year */}
        <div className="flex items-center justify-end gap-3">
          <ItemStatusBadge status={item.status} className="text-base" />

          {item.rate ? (
            <ItemRatingBadge rate={item.rate} className="text-base" />
          ) : null}

          {item.externalRating != null && (
            <ItemExternalRatingBadge
              rating={item.externalRating}
              className="text-base text-red-500"
            />
          )}

          {item.year && (
            <ItemYearBadge year={item.year} className="text-base" />
          )}
        </div>
      </div>
    </CardContainer>
  );
};

export { HomeLargeItem };
