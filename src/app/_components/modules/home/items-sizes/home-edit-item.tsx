import { Header, Paragraph } from "../../../ui";
import type { ItemType } from "../../../../../server/api/modules/item/types";
import {
  AddCommentModal,
  CardContainer,
  CloudinaryImage,
  DeleteItemModal,
  ItemTypeBadge,
  UpdateItemModal,
  UpdateItemImageModal,
  UpdateTagsModal,
} from "../../../shared";
import type { TagType } from "../../../../../server/api/modules/tag/types";

type Props = {
  item: ItemType;
  tags: TagType[];
  selectedCollectionsIds: string[];
};

const HomeEditItem = (props: Props) => {
  const { item, tags } = props;
  const itemTags = tags.filter((tag) =>
    tag.collections.map((c) => c.name).includes(item.collection.name),
  );
  return (
    <CardContainer className="relative h-fit overflow-hidden flex-col p-4">
      {item.image && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <CloudinaryImage
            variant="background"
            className="!aspect-auto h-full w-full rounded-none border-0 object-cover opacity-5 blur-sm shadow-none"
            publicId={item.image}
            folder={item.collection.name}
          />
        </div>
      )}

      <div
        className="pointer-events-none absolute inset-0 z-[1] opacity-[0.035]"
        style={{ backgroundImage: "url('/halftone.png')", backgroundRepeat: "repeat" }}
      />

      <div className="relative z-10 flex gap-4">
        <UpdateItemImageModal item={item}>
          <div className="aspect-[27/40] h-36 cursor-pointer transition-all duration-300 ease-in-out hover:scale-105 sm:h-72">
            {item.image ? (
              <CloudinaryImage
                publicId={item.image}
                folder={item.collection.name}
              />
            ) : (
              <div className="aspect-[27/40] rounded-sm bg-primary object-cover" />
            )}
          </div>
        </UpdateItemImageModal>

        <div className="flex w-full flex-col justify-between gap-2">
          <div className="flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <Header vtag="h5" className="line-clamp-2">
                {item.title}
              </Header>
              <ItemTypeBadge collectionName={item.collection.name} />
            </div>

            <Paragraph className="font-semibold text-muted-foreground">
              {item.year}
            </Paragraph>
          </div>

          <AddCommentModal item={item} />
          <div className="hidden flex-col gap-2 sm:flex">
            <UpdateItemModal item={item} />
            <UpdateTagsModal item={item} tags={itemTags} />
          </div>
        </div>
      </div>

      <div className="relative z-10 flex flex-col gap-2 sm:hidden">
        <UpdateItemModal item={item} />
        <UpdateTagsModal item={item} tags={itemTags} />
        <DeleteItemModal item={item} />
      </div>

      <div className="relative z-10 hidden sm:block">
        <DeleteItemModal item={item} />
      </div>
    </CardContainer>
  );
};

export { HomeEditItem };
