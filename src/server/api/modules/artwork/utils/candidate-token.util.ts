import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "~/env";
import type { ArtworkKind, ArtworkSourceName } from "../types/artwork.type";

/**
 * A candidate id is a signed, opaque token — not a URL. The gallery hands one
 * back when the user picks a cover, and the server decodes the real source URL
 * from it. The signature is what makes it trustworthy: a browser cannot mint a
 * token pointing at an arbitrary host. The decoded URL still runs through the
 * hardened download pipeline (host allowlist + SSRF checks) as defence in depth.
 */
export type CandidatePayload = {
  s: ArtworkSourceName;
  u: string;
  k: ArtworkKind;
};

const base64url = (input: Buffer | string): string =>
  Buffer.from(input).toString("base64url");

const sign = (payload: string): string =>
  createHmac("sha256", env.SECRET_CLIENT_COOKIE_VAR)
    .update(payload)
    .digest("base64url");

export const encodeCandidateId = (payload: CandidatePayload): string => {
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
};

export const decodeCandidateId = (token: string): CandidatePayload | null => {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);

  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as CandidatePayload;

    if (typeof parsed.s !== "string" || typeof parsed.u !== "string") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};
