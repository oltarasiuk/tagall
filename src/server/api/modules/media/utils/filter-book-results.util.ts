import type { MediaKindType, ProviderSearchResultType } from "../types";
import { isLikelySingleIssue } from "./classify-book-kind.util";

/**
 * What a book source is allowed to return.
 *
 * The Comic tab shows only what the classifier calls a comic — a prose novel
 * there is noise. The Book tab keeps graphic novels: they are still routed to
 * the Comic collection on add, so the user sees them rather than losing them.
 *
 * Single issues are dropped everywhere: the collections are the items.
 */
export function isWantedBookResult(
  result: Pick<ProviderSearchResultType, "mediaKind" | "title">,
  requestedKind: MediaKindType | undefined,
): boolean {
  if (isLikelySingleIssue(result.title)) {
    return false;
  }

  if (requestedKind === "comic") {
    return result.mediaKind === "comic";
  }

  return true;
}
