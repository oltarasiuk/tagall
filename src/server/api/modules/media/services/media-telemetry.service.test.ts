import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "~/lib/logger";
import { logItemCreated, logMediaOperation } from "./media-telemetry.service";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logMediaOperation", () => {
  it("logs the request metrics as one line and omits absent fields", () => {
    const debug = vi.spyOn(logger, "debug").mockImplementation(() => undefined);

    logMediaOperation({
      provider: "openlibrary",
      operation: "search",
      status: 200,
      resultCount: 12,
      retryCount: 1,
      durationMs: 340,
    });

    expect(debug).toHaveBeenCalledWith(
      "[media] provider=openlibrary operation=search status=200 results=12 retries=1 ms=340",
    );
  });

  it("logs a failure at error level with its typed code", () => {
    const error = vi.spyOn(logger, "error").mockImplementation(() => undefined);

    logMediaOperation({
      provider: "hardcover",
      operation: "details",
      code: "PROVIDER_TIMEOUT",
      canonicalKey: "hardcover:12345",
      durationMs: 25_000,
    });

    expect(error).toHaveBeenCalledWith(
      "[media] provider=hardcover operation=details code=PROVIDER_TIMEOUT key=hardcover:12345 ms=25000",
    );
  });
});

describe("logItemCreated", () => {
  it("records the canonical key of the created item", () => {
    const info = vi.spyOn(logger, "info").mockImplementation(() => undefined);

    logItemCreated({
      provider: "vndb",
      canonicalKey: "vndb:v17",
      itemId: "clx1",
      durationMs: 900,
    });

    expect(info).toHaveBeenCalledWith(
      "[media] provider=vndb operation=create key=vndb:v17 item=clx1 ms=900",
    );
  });
});
