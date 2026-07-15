import { cn } from "../../../lib";
import { Tooltip } from "../ui";

type Props = {
  rate: number;
  className?: string;
};

const ItemRatingBadge = ({ rate, className }: Props) => {
  if (rate <= 0) return null;

  return (
    <Tooltip content="My rating">
      <span
        className={cn(
          "flex items-center gap-1 font-semibold text-yellow-400",
          className,
        )}
      >
        <span>★</span>
        <span>{Math.round(rate * 10) / 10}</span>
      </span>
    </Tooltip>
  );
};

export { ItemRatingBadge };
