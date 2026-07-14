import type { MediaKindType, ProviderNameType } from "./provider.type";

export type ExternalIdentifierValueType = {
  provider: ProviderNameType;
  externalId: string;
  url?: string | null;
};

/**
 * Ratings from different providers are never comparable raw: a 4.3 on
 * Hardcover's 5-point scale is not a 4.3 on IGDB's 100-point one. Every
 * adapter reports its own scale and vote count, and `normalized10` is the only
 * value the app may compare or display.
 */
export type NormalizedRatingType = {
  source: ProviderNameType;
  value: number;
  scale: number;
  normalized10: number;
  votes: number | null;
  kind: "user" | "critic" | "bayesian";
};

export type PopularitySignalType = {
  source: ProviderNameType;
  value: number;
  kind: "votes" | "members" | "readers" | "owners" | "activity" | "hype";
};

export type ImageCandidateType = {
  source: ProviderNameType;
  url: string;
  width: number | null;
  height: number | null;
  language: string | null;
  likes: number | null;
  kind: "cover" | "poster" | "grid";
  /** False when the provider's terms forbid storing a copy (e.g. Google Books). */
  canPersist: boolean;
};

export type ProviderSearchInputType = {
  query: string;
  limit: number;
  mediaKind?: MediaKindType;
};

export type ProviderSearchResultType = {
  provider: ProviderNameType;
  externalId: string;
  mediaKind: MediaKindType;
  title: string;
  originalTitle: string | null;
  /** Provider aliases participate in title-only search and work matching. */
  alternateTitles?: string[];
  /** A semantic discriminator such as "graphic novel" or "omnibus". */
  workSubtype?: string | null;
  originalLanguage: string | null;
  year: number | null;
  description: string | null;
  authorsOrCreators: string[];
  seriesName: string | null;
  seriesPosition: string | null;
  identifiers: ExternalIdentifierValueType[];
  /**
   * Editions of a work, kept only to match it across providers: two book
   * sources agree on ISBNs long before they agree on titles. Not persisted —
   * an ISBN names an edition, and an item is a work.
   */
  isbns: string[];
  imageCandidates: ImageCandidateType[];
  rating: NormalizedRatingType | null;
  /** Provider-native signal; normalized only within one search candidate pool. */
  popularity?: PopularitySignalType | null;
  genres: string[];
  keywords: string[];
  /** Lower = more relevant, as ranked by the provider itself. */
  relevanceRank: number;
  sourceUrl: string | null;
};

/**
 * What the create flow persists. The client never sends this: the server
 * re-fetches details by provider + external id so a tampered payload cannot
 * decide what lands in the database.
 */
export type NormalizedItemDetailsType = {
  mediaKind: MediaKindType;
  title: string;
  originalTitle: string | null;
  originalLanguage: string | null;
  year: number | null;
  description: string | null;
  sourceUrl: string | null;
  identifiers: ExternalIdentifierValueType[];
  imageCandidates: ImageCandidateType[];
  rating: NormalizedRatingType | null;
  /** Keyed by field group name: genres, keywords, people, production, ... */
  fields: Record<string, string | number | string[] | null>;
};

export interface MediaProviderAdapterType {
  readonly name: ProviderNameType;
  readonly supportedKinds: readonly MediaKindType[];
  /** False when the provider's credentials are missing or it is feature-flagged off. */
  readonly enabled: boolean;
  search(input: ProviderSearchInputType): Promise<ProviderSearchResultType[]>;
  getDetails(externalId: string): Promise<NormalizedItemDetailsType>;
}
