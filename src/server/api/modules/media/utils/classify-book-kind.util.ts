import type { MediaKindType } from "../types";
import { normalizeTitle } from "./normalize-title.util";

/**
 * Book sources do not know the difference between a novel and a graphic novel:
 * both are "books" to Open Library and Hardcover. The collection does care, so
 * the subject and genre labels decide.
 *
 * The signals are evidence, not proof. A work is only routed to Comic when it
 * says so; anything ambiguous stays a Book, because a novel filed under Comic
 * is a worse mistake than a graphic novel filed under Book (the user can see
 * the first one is wrong and never finds the second one at all).
 */

const COMIC_SIGNALS = [
  "comic",
  "comics",
  "comic book",
  "comic books",
  "comic strips",
  "graphic novel",
  "graphic novels",
  "bandes dessinees",
  "bandes dessinées",
  "cartoons and comics",
  "superhero",
  "superheroes",
];

/**
 * Single issues are not items: "Saga #12" is a chapter of a collected edition.
 * The Comic collection tracks the collections, so an issue number in the title
 * disqualifies a result.
 */
const SINGLE_ISSUE = /#\s*\d+/;

/** Normalization turns a label into space-separated words, so a padded
 * substring test is a whole-word test: "comic" matches "comic books, strips,
 * etc." but not "comical". */
const matchesComicSignal = (label: string): boolean => {
  const normalized = normalizeTitle(label);

  if (!normalized) {
    return false;
  }

  const padded = ` ${normalized} `;

  return COMIC_SIGNALS.some((signal) =>
    padded.includes(` ${normalizeTitle(signal)} `),
  );
};

export function classifyBookKind(
  labels: readonly (string | null | undefined)[],
): MediaKindType {
  const hasComicSignal = labels.some(
    (label) => !!label && matchesComicSignal(label),
  );

  return hasComicSignal ? "comic" : "book";
}

export const isLikelySingleIssue = (title: string): boolean =>
  SINGLE_ISSUE.test(title);
