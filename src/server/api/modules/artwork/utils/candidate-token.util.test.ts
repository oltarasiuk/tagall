import { beforeAll, describe, expect, it, vi } from "vitest";

vi.stubEnv("SECRET_CLIENT_COOKIE_VAR", "test-secret-for-candidate-tokens");

const { encodeCandidateId, decodeCandidateId } = await import(
  "./candidate-token.util"
);

describe("candidate token", () => {
  const payload = {
    s: "openlibrary" as const,
    u: "https://covers.openlibrary.org/b/id/42-L.jpg?default=false",
    k: "cover" as const,
  };

  beforeAll(() => {
    // Ensure the stubbed secret is visible to the signer.
    process.env.SECRET_CLIENT_COOKIE_VAR = "test-secret-for-candidate-tokens";
  });

  it("round-trips a payload", () => {
    const token = encodeCandidateId(payload);
    expect(decodeCandidateId(token)).toEqual(payload);
  });

  it("rejects a tampered body", () => {
    const token = encodeCandidateId(payload);
    const [, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...payload, u: "https://evil.example/x.jpg" }),
    ).toString("base64url");

    expect(decodeCandidateId(`${forged}.${signature}`)).toBeNull();
  });

  it("rejects a malformed token", () => {
    expect(decodeCandidateId("not-a-token")).toBeNull();
    expect(decodeCandidateId("")).toBeNull();
  });
});
