import { describe, expect, it } from "vitest";
import { isAllowedImageHost } from "./image-hosts.const";

describe("isAllowedImageHost", () => {
  it("accepts the provider CDNs we download from", () => {
    expect(
      isAllowedImageHost("https://covers.openlibrary.org/b/id/1-L.jpg"),
    ).toBe(true);
    expect(
      isAllowedImageHost("https://images.igdb.com/igdb/image/upload/x.jpg"),
    ).toBe(true);
  });

  it("rejects hosts outside the allowlist, including lookalikes", () => {
    expect(isAllowedImageHost("https://evil.com/poster.jpg")).toBe(false);
    expect(
      isAllowedImageHost("https://covers.openlibrary.org.evil.com/x.jpg"),
    ).toBe(false);
  });

  it("rejects local and non-http targets", () => {
    expect(isAllowedImageHost("http://127.0.0.1/poster.jpg")).toBe(false);
    expect(isAllowedImageHost("http://localhost:3000/poster.jpg")).toBe(false);
    expect(isAllowedImageHost("file:///etc/passwd")).toBe(false);
    expect(isAllowedImageHost("data:image/png;base64,AAA")).toBe(false);
  });

  it("rejects credentials embedded in the URL", () => {
    expect(
      isAllowedImageHost("https://user:pass@covers.openlibrary.org/b/id/1.jpg"),
    ).toBe(false);
  });

  it("rejects garbage instead of throwing", () => {
    expect(isAllowedImageHost("not a url")).toBe(false);
  });
});
