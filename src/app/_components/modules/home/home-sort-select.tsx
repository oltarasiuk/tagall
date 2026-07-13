import {
  Paragraph,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "../../ui";
import { SORT_OPTIONS } from "../../../../constants";
import type { GetUserItemsSortType } from "../../../../server/api/modules/item/types";
import { GrainCardContainer } from "../../shared";

type Props = {
  sorting: GetUserItemsSortType;
  setSorting: (data: GetUserItemsSortType) => void;
};

const HomeSortSelect = (props: Props) => {
  const { setSorting, sorting } = props;

  return (
    <GrainCardContainer>
      <Select
        onValueChange={(value) => {
          const selectedOption = SORT_OPTIONS.find(
            (option) => JSON.stringify(option) === value,
          );
          if (selectedOption) {
            setSorting(selectedOption);
          }
        }}
      >
        <SelectTrigger className="h-full w-28 justify-center gap-2 border-0 bg-transparent shadow-none hover:bg-accent">
          <Paragraph>{sorting.type === "asc" ? "▼" : "▲"}</Paragraph>
          <Paragraph className="capitalize">{sorting.name}</Paragraph>
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((option) => (
            <SelectItem
              key={`${option.type}-${option.name}`}
              value={JSON.stringify(option)}
            >
              <div className="flex gap-2">
                <Paragraph>{option.type === "asc" ? "▼" : "▲"}</Paragraph>
                <Paragraph className="capitalize">{option.name}</Paragraph>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </GrainCardContainer>
  );
};

export { HomeSortSelect };
