import { Button } from "../../ui";
import { Grid2x2, Grid3x3 } from "lucide-react";
import { GrainCardContainer } from "../../shared";

export type ItemSize = "medium" | "large";

type Props = {
  itemSize: ItemSize;
  setItemSize: (data: ItemSize) => void;
};

const HomeItemSizeTabs = (props: Props) => {
  const { itemSize, setItemSize } = props;
  return (
    <GrainCardContainer>
      <Button
        onClick={() => setItemSize("large")}
        size={"icon"}
        variant={itemSize === "large" ? "default" : "ghost"}
      >
        <Grid2x2 />
      </Button>
      <Button
        onClick={() => setItemSize("medium")}
        size={"icon"}
        variant={itemSize === "medium" ? "default" : "ghost"}
      >
        <Grid3x3 />
      </Button>
    </GrainCardContainer>
  );
};

export { HomeItemSizeTabs };
