# TagAll

Private, single-user media tracker for films, series, manga, books, comics,
visual novels, games and board games.

## Local setup

1. Copy `.env.example` to `.env` and fill only the server-side credentials you
   use. Never put API keys in `NEXT_PUBLIC_*` variables.
2. Install dependencies with `pnpm install`.
3. Generate the Prisma client and apply the existing migrations:
   `pnpm exec prisma generate && pnpm db:migrate`.
4. Seed collections and field groups with `pnpm exec prisma db seed`.
5. Start the app with `pnpm dev`.

## Media providers

Open Library is the primary Book/Comic work source and needs no key; set
`OPEN_LIBRARY_CONTACT_EMAIL` for an identified User-Agent. Hardcover enriches
books when `HARDCOVER_API_TOKEN` is configured. Both are queried server-side;
book and comic text search is title-only and stores work identities, never ISBN
editions.

IGDB, RAWG, SteamGridDB, Fanart.tv and BoardGameGeek are optional integrations.
BoardGameGeek must stay disabled until its application token is approved.
Google Books is discovery-only and disabled by default: it must use a separate
restricted `GOOGLE_BOOKS_API_KEY`, never OAuth credentials, and its results may
not be imported directly.

Provider registration: [Open Library](https://openlibrary.org/developers/api),
[Hardcover](https://docs.hardcover.app/api/getting-started),
[IGDB](https://api-docs.igdb.com/), [RAWG](https://rawg.io/apidocs),
[BoardGameGeek](https://boardgamegeek.com/wiki/page/BGG_XML_API2), and
[VNDB](https://api.vndb.org/kana).

## Attribution and poster handling

The application footer attributes enabled data providers. RAWG data requires
its active backlink; Google discovery results require their own branding.
Provider cover URLs are never hotlinked for saved items: the server validates,
downloads and stores an allowed image in Cloudinary. Adding an item without a
safe cover is intentionally blocked until one is supplied.

## Verification checklist

Run the normal checks before handing off changes:

```bash
pnpm test
pnpm lint
pnpm build
pnpm exec prisma validate
pnpm exec prisma generate
git diff --check
```

With configured credentials, smoke-test `Dune` (Book), `Watchmen` (Comic), a
visual novel, `The Witcher 3` (base game only), and `Gloomhaven` (base game
only). Verify that disabling any optional provider still leaves other results
available and that saved posters point to Cloudinary.
