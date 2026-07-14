/**
 * Hosts we are willing to download a poster from. A provider URL is attacker-
 * adjacent data: it decides which host the server connects to, so it is checked
 * against this list before the request and again after every redirect.
 */
export const ALLOWED_IMAGE_HOSTS: readonly string[] = [
  "covers.openlibrary.org",
  // Open Library's Covers endpoint legitimately redirects older covers to its
  // Internet Archive storage. Keep the redirect hop allowlisted rather than
  // treating a valid Open Library cover as an unsafe URL.
  "archive.org",
  "images.igdb.com",
  "cdn2.steamgriddb.com",
  "cdn.steamgriddb.com",
  "media.rawg.io",
  "cf.geekdo-images.com",
  "cf.geekdo-static.com",
  "t.vndb.org",
  "s2.vndb.org",
  "assets.fanart.tv",
  "image.tmdb.org",
  "s4.anilist.co",
  "uploads.mangadex.org",
];

export function isAllowedImageHost(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return false;
    }

    // Credentials in the URL are never legitimate for a public image.
    if (url.username || url.password) {
      return false;
    }

    const hostname = url.hostname.toLowerCase();

    return (
      ALLOWED_IMAGE_HOSTS.includes(hostname) ||
      // The Covers service redirects archive.org through numbered Internet
      // Archive download nodes, e.g. ia800404.us.archive.org. Restrict this
      // to that hostname pattern rather than allowing arbitrary subdomains.
      /^ia\d+\.us\.archive\.org$/.test(hostname)
    );
  } catch {
    return false;
  }
}
