import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getOrSetCache } from "~/lib/redis";
import { GetArtworkCandidatesInputSchema } from "./schemas/artwork.schema";
import { getArtworkCandidates } from "./services/artwork-search.service";

export const ArtworkRouter = createTRPCRouter({
  getCandidates: protectedProcedure
    .input(GetArtworkCandidatesInputSchema)
    .query(async ({ ctx, input }) => {
      // Candidate lists are stable for an item; cache like other media reads.
      return getOrSetCache(
        () => getArtworkCandidates(input),
        "artwork",
        "getCandidates",
        { userId: ctx.session.user.id, input },
      );
    }),
});
