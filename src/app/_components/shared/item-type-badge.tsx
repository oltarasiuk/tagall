import { Badge } from "../ui/badge";
import { cn } from "../../../lib";

const TYPE_BADGE_STYLES: Record<string, string> = {
  Film: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  Serie: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  Manga: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  Book: "bg-red-500/15 text-red-400 border-red-500/30",
  Comic: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

type Props = {
  collectionName: string;
  className?: string;
};

const ItemTypeBadge = ({ collectionName, className }: Props) => {
  const style = TYPE_BADGE_STYLES[collectionName];
  if (!style) return null;

  return (
    <Badge variant="collection" className={cn(style, className)}>
      {collectionName}
    </Badge>
  );
};

export { ItemTypeBadge, TYPE_BADGE_STYLES };
