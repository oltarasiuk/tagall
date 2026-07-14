import { Paragraph } from "../../ui";
import type { ParseRegrexResult } from "../../../../server/api/modules/parse/types";
import { mergeSearchParams } from "../../../../lib";
import type { AddParamsType } from "../add/add-container";
import Link from "next/link";
import { RATING_NAMES, STATUS_NAMES } from "../../../../constants";
import type { ItemStatus } from "@prisma/client";

type Props = {
  item: ParseRegrexResult;
  index: number;
};

const ParseItemResult = (props: Props) => {
  const { item, index } = props;

  let link = "";
  if (item.id) {
    link = `/item/${item.id}`;
  } else {
    const params: AddParamsType = {
      query: item.year ? `${item.title} (${item.year})` : item.title,
      collectionIds: [item.collectionId],
    };
    const query = mergeSearchParams(params);
    link = `/add${query}`;
  }

  return (
    <Link
      href={link}
      target="_blank"
      className={"flex gap-8 hover:text-primary"}
    >
      <Paragraph className="w-8">{index} </Paragraph>

      <Paragraph className="w-4 text-end">{item.id ? "+" : "-"}</Paragraph>

      <Paragraph className="w-full">{item.title} </Paragraph>
      <Paragraph className="w-10 text-end">{item.year}</Paragraph>

      <Paragraph className="w-48 text-end">
        {item.rate ? `${RATING_NAMES[item.rate]} | ${item.rate}` : ""}
      </Paragraph>
      <Paragraph className="w-36 text-end">
        {item.status ? STATUS_NAMES[item.status as ItemStatus] : ""}
      </Paragraph>
    </Link>
  );
};

export { ParseItemResult };
