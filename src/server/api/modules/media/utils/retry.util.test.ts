import { describe, expect, it } from "vitest";
import { getRetryDelayMs, isRetryableStatus } from "./retry.util";

describe("isRetryableStatus", () => {
  it("retries only transient statuses", () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(502)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(504)).toBe(true);
  });

  it("does not retry permanent answers", () => {
    for (const status of [400, 401, 403, 404, 200]) {
      expect(isRetryableStatus(status)).toBe(false);
    }
    expect(isRetryableStatus(null)).toBe(false);
  });
});

describe("getRetryDelayMs", () => {
  it("honours Retry-After given in seconds", () => {
    expect(getRetryDelayMs({ attempt: 0, retryAfterHeader: "3" })).toBe(3_000);
  });

  it("honours Retry-After given as an HTTP date", () => {
    const now = Date.parse("2026-07-14T20:00:00Z");

    expect(
      getRetryDelayMs({
        attempt: 0,
        retryAfterHeader: "Tue, 14 Jul 2026 20:00:04 GMT",
        now,
      }),
    ).toBe(4_000);
  });

  it("caps Retry-After so a provider cannot stall the request forever", () => {
    expect(
      getRetryDelayMs({ attempt: 0, retryAfterHeader: "600", maxDelayMs: 10_000 }),
    ).toBe(10_000);
  });

  it("backs off exponentially without a Retry-After header", () => {
    expect(getRetryDelayMs({ attempt: 0, baseDelayMs: 500 })).toBe(500);
    expect(getRetryDelayMs({ attempt: 1, baseDelayMs: 500 })).toBe(1_000);
    expect(getRetryDelayMs({ attempt: 2, baseDelayMs: 500 })).toBe(2_000);
  });
});
