/**
 * Hosts we are willing to download a poster from. A provider URL is attacker-
 * adjacent data: it decides which host the server connects to, so it is checked
 * against this list before the request and again after every redirect.
 */
export const ALLOWED_IMAGE_HOSTS: readonly string[] = [
  "covers.openlibrary.org",
  "images.igdb.com",
  "cdn2.steamgriddb.com",
  "cdn.steamgriddb.com",
  "media.rawg.io",
  "cf.geekdo-images.com",
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

    return ALLOWED_IMAGE_HOSTS.includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}
