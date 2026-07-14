const FILM = "cm3a9sw1v000gi1s7appi2tju";
const SERIE = "cm3bnlve100000ks784yufzt9";
const BOOK = "cm3bnlxhu00020ks7hyps1g0a";
const MANGA = "cm3bnlyzw00040ks77yx39ddf";
const COMIC = "cmi75xx8zbqwcuglg4iivite7";
// Generated once with cuid and intentionally fixed: existing collection ids
// must remain stable because tags and items reference them.
const GAME = "cmrl220pm0000re46h0k0dqxj";
const BOARD_GAME = "cmrl220pp0001re4683ab1dkk";

export const seedsData = {
  collections: [
    { id: FILM, name: "Film", slug: "film", priority: 1 },
    { id: SERIE, name: "Serie", slug: "serie", priority: 2 },
    { id: BOOK, name: "Book", slug: "book", priority: 3 },
    { id: MANGA, name: "Manga", slug: "manga", priority: 4 },
    { id: COMIC, name: "Comic", slug: "comic", priority: 5 },
    { id: GAME, name: "Game", slug: "game", priority: 6 },
    { id: BOARD_GAME, name: "Board Game", slug: "board-game", priority: 7 },
  ],
  fieldGroups: [
    {
      id: "cm4vpygr80004ius76k8f8ra1",
      name: "genres",
      priority: 1,
      isFiltering: true,
      collections: [FILM, SERIE, BOOK, MANGA, COMIC, GAME, BOARD_GAME],
    },
    {
      id: "cm3a9sqbe000ci1s74wjod48c",
      name: "contentRating",
      priority: 2,
      isFiltering: true,
      collections: [FILM, SERIE, GAME],
    },
    {
      id: "cm3a9so0i000ai1s77en3aul5",
      name: "keywords",
      priority: 3,
      isFiltering: true,
      collections: [FILM, SERIE, BOOK, MANGA, COMIC, GAME],
    },
    {
      id: "cm3a9sse6000ei1s7cvwshatu",
      name: "production",
      priority: 4,
      isFiltering: true,
      collections: [FILM, SERIE, MANGA, COMIC, GAME, BOARD_GAME],
    },
    {
      id: "cm3a9sm6c0008i1s7ekkm28ed",
      name: "people",
      priority: 5,
      isFiltering: true,
      collections: [FILM, SERIE, BOOK, MANGA, COMIC, GAME, BOARD_GAME],
    },
    {
      id: "cm3hvqbhn0000hxs7gckv6nyi",
      name: "runtime",
      priority: 6,
      isFiltering: false,
      collections: [FILM],
    },
    {
      id: "cm4vpy3cr0000ius71dyb4il2",
      name: "volumes",
      priority: 7,
      isFiltering: false,
      collections: [MANGA],
    },
    {
      id: "cm4vpy5dz0002ius7d2ywbphx",
      name: "chapters",
      priority: 8,
      isFiltering: false,
      collections: [MANGA],
    },
    {
      id: "cmmmqjjzijfd6npmd8qnxkrxx",
      name: "series",
      priority: 9,
      isFiltering: true,
      collections: [BOOK, COMIC],
    },
    {
      id: "cmkch1wyktvs6jto5ya13elz1",
      name: "originalLanguage",
      priority: 10,
      isFiltering: true,
      collections: [BOOK, MANGA, COMIC],
    },
    {
      id: "cm8wmmq6yh5olde0n2gi884js",
      name: "platforms",
      priority: 11,
      isFiltering: true,
      collections: [GAME, COMIC],
    },
    {
      id: "cmrl223ep0000su46d1fn8dsf",
      name: "gameModes",
      priority: 12,
      isFiltering: true,
      collections: [GAME],
    },
    {
      id: "cmrl223es0001su4686kj487k",
      name: "themes",
      priority: 13,
      isFiltering: true,
      collections: [GAME],
    },
    {
      id: "cmrl223es0002su463x2q5046",
      name: "players",
      priority: 14,
      isFiltering: false,
      collections: [BOARD_GAME],
    },
    {
      id: "cmrl223es0003su46g8d935hv",
      name: "playingTime",
      priority: 15,
      isFiltering: false,
      collections: [BOARD_GAME],
    },
    {
      id: "cmrl223es0004su464s4s06l0",
      name: "complexity",
      priority: 16,
      isFiltering: false,
      collections: [BOARD_GAME],
    },
    {
      id: "cmrl223es0005su46be0tf0s6",
      name: "mechanics",
      priority: 17,
      isFiltering: true,
      collections: [BOARD_GAME],
    },
  ],
};
