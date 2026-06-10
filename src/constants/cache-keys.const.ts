export const CACHE_KEYS = {
  item: {
    getUserItems: {
      userId: true,
      collectionsIds: true,
      filtering: true,
      sorting: true,
      page: true,
      limit: true,
      search: true,
      input: true,
    },
    getAllUserItems: {
      userId: true,
      collectionsIds: true,
      filtering: true,
      sorting: true,
      search: true,
      input: true,
    },
    getUserItemsStats: {
      userId: true,
      collectionsIds: true,
      input: true,
    },
    getUserItem: {
      userId: true,
      input: true,
    },
    getNearestItems: {
      userId: true,
      input: true,
    },
    getYearsRange: {
      userId: true,
      collectionsIds: true,
      input: true,
    },
    searchItemByText: {
      userId: true,
      input: true,
    },
    getPublicUserItems: {
      userId: true,
      collectionsIds: true,
      filtering: true,
      sorting: true,
      page: true,
      limit: true,
      search: true,
      input: true,
    },
    getPublicAllUserItems: {
      userId: true,
      collectionsIds: true,
      filtering: true,
      sorting: true,
      search: true,
      input: true,
    },
    getPublicRandomUserItems: {
      input: true,
    },
    getPublicUserItemsStats: {
      userId: true,
      collectionsIds: true,
      input: true,
    },
    getPublicYearsRange: {
      userId: true,
      collectionsIds: true,
      input: true,
    },
  },
  collection: {
    getAll: true,
    getUserCollections: {
      userId: true,
    },
    getPublicUserCollections: {
      userId: true,
    },
  },
  field: {
    getFilterFields: {
      userId: true,
      collectionsIds: true,
      input: true,
    },
    getItemDetailFields: {
      input: true,
    },
    getPublicFilterFields: {
      userId: true,
      collectionsIds: true,
      input: true,
    },
  },
  parse: {
    search: {
      userId: true,
      input: true,
    },
    regrex: {
      userId: true,
      input: true,
    },
    imdbDetails: {
      parsedId: true,
    },
    tmdbMovieDetails: {
      tmdbId: true,
    },
    tmdbTvDetails: {
      tmdbId: true,
    },
    imdbCrawleeEnrich: {
      parsedId: true,
    },
    imdbSearch: {
      query: true,
      limit: true,
    },
  },
  tag: {
    getUserTags: {
      userId: true,
    },
  },
  comment: {
    getUserComments: {
      userId: true,
      input: true,
    },
  },
  user: {
    getUser: {
      userId: true,
    },
    getPublicUser: true,
  },
} as const;
