import { Heart } from "lucide-react";
import { cn } from "../../../lib";
import { Tooltip } from "../ui";

type Props = {
  rating: number;
  className?: string;
};

const ItemExternalRatingBadge = ({ rating, className }: Props) => {
  if (rating <= 0) return null;

  return (
    <Tooltip content="IMDB rating">
      <span className={cn("flex items-center gap-0.5 font-medium", className)}>
        <Heart className="h-[1em] w-[1em] fill-current" />
        <span>{rating}</span>
      </span>
    </Tooltip>
  );
};

export { ItemExternalRatingBadge };
