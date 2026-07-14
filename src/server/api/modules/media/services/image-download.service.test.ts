import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isMediaError } from "../errors/media.error";
import { downloadProviderImage } from "./image-download.service";

// The DNS/private-IP guard is exercised by assertPublicUrl itself; here it is
// stubbed so these tests never touch the network.
vi.mock("../../../helpers", () => ({
  assertPublicUrl: vi.fn().mockResolvedValue(undefined),
}));

const OPEN_LIBRARY_URL = "https://covers.openlibrary.org/b/id/1-L.jpg";

const makeJpeg = (width: number, height: number) =>
  sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 10, g: 20, b: 30 },
    },
  })
    .jpeg()
    .toBuffer();

function respondWith(props: {
  body: Buffer | string;
  contentType?: string;
  status?: number;
  headers?: Record<string, string>;
}) {
  const { body, contentType = "image/jpeg", status = 200, headers = {} } = props;

  return new Response(body as unknown as BodyInit, {
    status,
    headers: { "content-type": contentType, ...headers },
  });
}

const expectMediaError = async (promise: Promise<unknown>, code: string) => {
  await expect(promise).rejects.toSatisfy(
    (error: unknown) => isMediaError(error) && error.code === code,
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("downloadProviderImage", () => {
  it("returns a re-encoded webp buffer for a valid portrait cover", async () => {
    const jpeg = await makeJpeg(600, 900);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respondWith({ body: jpeg })));

    const image = await downloadProviderImage({
      url: OPEN_LIBRARY_URL,
      mediaKind: "book",
    });

    expect((await sharp(image.buffer).metadata()).format).toBe("webp");
    expect(image.width).toBe(600);
    expect(image.height).toBe(900);
  });

  it("refuses a host outside the allowlist before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expectMediaError(
      downloadProviderImage({
        url: "https://evil.com/poster.jpg",
        mediaKind: "book",
      }),
      "POSTER_UNSAFE_URL",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a redirect that leaves the allowlist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respondWith({
          body: "",
          status: 302,
          headers: { location: "http://127.0.0.1/poster.jpg" },
        }),
      ),
    );

    await expectMediaError(
      downloadProviderImage({ url: OPEN_LIBRARY_URL, mediaKind: "book" }),
      "POSTER_UNSAFE_URL",
    );
  });

  it("gives up after too many redirects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respondWith({
          body: "",
          status: 302,
          headers: { location: OPEN_LIBRARY_URL },
        }),
      ),
    );

    await expectMediaError(
      downloadProviderImage({ url: OPEN_LIBRARY_URL, mediaKind: "book" }),
      "POSTER_UNSAFE_URL",
    );
  });

  it("rejects HTML dressed up as a jpeg", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respondWith({ body: "<!doctype html><html>nope</html>" }),
      ),
    );

    await expectMediaError(
      downloadProviderImage({ url: OPEN_LIBRARY_URL, mediaKind: "book" }),
      "POSTER_INVALID_IMAGE",
    );
  });

  it("rejects a non-image content type", async () => {
    const jpeg = await makeJpeg(600, 900);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respondWith({ body: jpeg, contentType: "text/html" }),
      ),
    );

    await expectMediaError(
      downloadProviderImage({ url: OPEN_LIBRARY_URL, mediaKind: "book" }),
      "POSTER_INVALID_IMAGE",
    );
  });

  it("rejects an oversized image by its declared length", async () => {
    const jpeg = await makeJpeg(600, 900);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respondWith({
          body: jpeg,
          headers: { "content-length": String(11 * 1024 * 1024) },
        }),
      ),
    );

    await expectMediaError(
      downloadProviderImage({ url: OPEN_LIBRARY_URL, mediaKind: "book" }),
      "POSTER_INVALID_IMAGE",
    );
  });

  it("rejects a landscape image for a book cover", async () => {
    const jpeg = await makeJpeg(1200, 800);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respondWith({ body: jpeg })));

    await expectMediaError(
      downloadProviderImage({ url: OPEN_LIBRARY_URL, mediaKind: "book" }),
      "POSTER_INVALID_IMAGE",
    );
  });

  it("propagates a failed request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(respondWith({ body: "", status: 404 })),
    );

    await expectMediaError(
      downloadProviderImage({ url: OPEN_LIBRARY_URL, mediaKind: "book" }),
      "POSTER_DOWNLOAD_FAILED",
    );
  });
});
