import type { MediaKindType } from "../types";
import { isLikelySingleIssue } from "./classify-book-kind.util";
import { normalizeTitle } from "./normalize-title.util";

/**
 * What a book source is allowed to return.
 *
 * Tabs are routing boundaries: Book only returns Book works and Comic only
 * returns Comic works. A graphic adaptation must never be silently presented
 * as the original prose novel.
 *
 * Single issues are dropped everywhere: the collections are the items.
 */
export function isWantedBookResult(
  result: {
    mediaKind: MediaKindType;
    title: string;
    originalTitle?: string | null;
    alternateTitles?: string[];
  },
  requestedKind: MediaKindType | undefined,
): boolean {
  if (isLikelySingleIssue(result.title)) {
    return false;
  }

  if (requestedKind === "comic") {
    return result.mediaKind === "comic";
  }

  if (requestedKind === "book") {
    return result.mediaKind === "book";
  }

  return true;
}

/**
 * Book and comic text search is deliberately title-only. This is also used as
 * a defensive local filter for providers which cannot guarantee a fielded
 * title query. In particular, a query of "1984" must never match a year or a
 * description occurrence.
 */
export function matchesBookTitle(
  result: {
    title: string;
    originalTitle?: string | null;
    alternateTitles?: string[];
  },
  query: string,
): boolean {
  const normalizedQuery = normalizeTitle(query);
  if (!normalizedQuery) return false;

  const tokens = normalizedQuery.split(" ").filter(Boolean);
  return [result.title, result.originalTitle, ...(result.alternateTitles ?? [])]
    .filter((title): title is string => Boolean(title))
    .map(normalizeTitle)
    .some(
      (title) =>
        title === normalizedQuery ||
        title.startsWith(normalizedQuery) ||
        tokens.every((token) => title.includes(token)),
    );
}
