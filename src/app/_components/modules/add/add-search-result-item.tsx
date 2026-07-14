"use client";
import Image from "next/image";
import type { Dispatch, SetStateAction } from "react";
import type { SearchResultType } from "../../../../server/api/modules/parse/types";
import { cn } from "../../../../lib";
import { CardContainer, ItemRatingBadge, ItemTypeBadge } from "../../shared";
import { Badge } from "../../ui/badge";

type Props = {
  searchResult: SearchResultType;
  setSelectedItem: Dispatch<SetStateAction<SearchResultType | null>>;
  disableHover?: boolean;
};

/** The collection the provider suggested names the type. An unknown result is
 * labelled as such — calling it a Manga (the old fallback) mislabels every
 * book, comic and game. */
function getTypeLabel(searchResult: SearchResultType): string {
  if (searchResult.suggestedCollectionName)
    return searchResult.suggestedCollectionName;
  if (searchResult.mediaType === "movie") return "Film";
  if (searchResult.mediaType === "tv") return "Serie";
  return "Unknown";
}

const AddSearchResultItem = (props: Props) => {
  const { searchResult, setSelectedItem, disableHover = false } = props;
  const typeLabel = getTypeLabel(searchResult);

  return (
    <CardContainer
      className={cn(
        "relative overflow-hidden p-0 transition-all duration-300",
        !disableHover && "cursor-pointer",
        !disableHover &&
          !searchResult.id &&
          "hover:scale-105 hover:border-primary/50 hover:shadow-md",
      )}
      onClick={() => {
        if (!disableHover && !searchResult.id)
          setSelectedItem(() => searchResult);
      }}
    >
      {/* Blurred background image */}
      {searchResult.image && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <Image
            src={searchResult.image}
            alt=""
            className="h-full w-full rounded-none border-0 object-cover opacity-5 blur-sm"
            width={300}
            height={450}
            unoptimized
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
      <div className="relative z-10 aspect-[27/40] w-[110px] flex-shrink-0 self-start sm:w-[150px]">
        {searchResult.image ? (
          <Image
            src={searchResult.image}
            alt={"cover " + (searchResult.title ?? "")}
            className="h-full w-full rounded-l-lg object-cover"
            width={150}
            height={225}
            unoptimized
          />
        ) : (
          <div className="h-full w-full rounded-l-lg bg-muted" />
        )}
      </div>

      {/* Content */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-between gap-2 px-4 py-3">
        {/* Title + badges row */}
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-base font-bold leading-snug sm:text-lg">
            {searchResult.title}
          </p>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            {searchResult.id && (
              <Badge
                variant="outline"
                className="rounded-md border-green-500/40 bg-green-500/15 px-2 py-0.5 text-xs font-semibold text-green-400"
              >
                Added
              </Badge>
            )}
            <ItemTypeBadge collectionName={typeLabel} />
          </div>
        </div>

        {searchResult.originalTitle &&
          searchResult.originalTitle !== searchResult.title && (
            <p className="line-clamp-1 text-sm text-muted-foreground">
              {searchResult.originalTitle}
            </p>
          )}
        {searchResult.creators?.length ? (
          <p className="line-clamp-1 text-sm text-muted-foreground">
            {searchResult.creators.join(", ")}
            {searchResult.seriesPosition
              ? ` · ${searchResult.seriesPosition}`
              : ""}
          </p>
        ) : null}

        {/* Description */}
        {searchResult.description && (
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {searchResult.description}
          </p>
        )}

        {/* Rating + year row */}
        <div className="flex min-w-0 items-center justify-end gap-3">
          {searchResult.year != null && (
            <span className="sm:text-md text-base font-semibold text-muted-foreground">
              {searchResult.year}
            </span>
          )}
          {searchResult.rating != null && (
            <div
              className="flex items-center gap-1"
              title={searchResult.ratingSource ?? undefined}
            >
              <ItemRatingBadge
                rate={searchResult.rating}
                className="sm:text-md text-base"
              />
            </div>
          )}
        </div>
      </div>
    </CardContainer>
  );
};

export { AddSearchResultItem };
