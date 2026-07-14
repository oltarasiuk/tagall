import { describe, expect, it } from "vitest";
import { classifyBookKind, isLikelySingleIssue } from "./classify-book-kind.util";
import { isWantedBookResult } from "./filter-book-results.util";

describe("classifyBookKind", () => {
  it("routes a graphic novel to Comic", () => {
    expect(
      classifyBookKind(["Fiction", "Comic books, strips, etc.", "Dystopias"]),
    ).toBe("comic");
    expect(classifyBookKind(["Graphic Novels", "Superheroes"])).toBe("comic");
  });

  it("leaves a prose novel a Book", () => {
    expect(classifyBookKind(["Science Fiction", "Fiction", "Desert people"])).toBe(
      "book",
    );
  });

  it("does not read a comic signal into a longer word", () => {
    // "comical" is not "comic": a false Comic hides a novel in the wrong tab.
    expect(classifyBookKind(["Comical essays"])).toBe("book");
  });

  it("defaults to Book when nothing is labelled", () => {
    expect(classifyBookKind([])).toBe("book");
    expect(classifyBookKind([null, undefined])).toBe("book");
  });
});

describe("isLikelySingleIssue", () => {
  it("recognises an issue number", () => {
    expect(isLikelySingleIssue("Saga #12")).toBe(true);
    expect(isLikelySingleIssue("The Sandman # 8")).toBe(true);
  });

  it("leaves collected editions alone", () => {
    expect(isLikelySingleIssue("Saga, Vol. 3")).toBe(false);
    expect(isLikelySingleIssue("Watchmen")).toBe(false);
  });
});

describe("isWantedBookResult", () => {
  it("drops single issues everywhere: the collections are the items", () => {
    expect(
      isWantedBookResult({ mediaKind: "comic", title: "Saga #12" }, "comic"),
    ).toBe(false);
    expect(
      isWantedBookResult({ mediaKind: "comic", title: "Saga #12" }, undefined),
    ).toBe(false);
  });

  it("shows only comics in the Comic tab", () => {
    expect(
      isWantedBookResult({ mediaKind: "book", title: "Dune" }, "comic"),
    ).toBe(false);
    expect(
      isWantedBookResult({ mediaKind: "comic", title: "Watchmen" }, "comic"),
    ).toBe(true);
  });

  it("keeps graphic novels found from the Book tab: they are routed on add", () => {
    expect(
      isWantedBookResult({ mediaKind: "comic", title: "Watchmen" }, "book"),
    ).toBe(true);
  });
});
