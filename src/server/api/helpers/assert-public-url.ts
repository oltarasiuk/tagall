import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Throws if the URL must not be fetched by the server:
 * - non-http(s) protocol
 * - hostname resolves to a private / loopback / link-local / metadata address
 *
 * Limitation: does not protect against DNS rebinding (TOCTOU). Acceptable
 * for this project; revisit if the app becomes multi-tenant.
 */
export async function assertPublicUrl(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http/https URLs are allowed");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets

  const addresses: string[] = [];
  if (isIP(hostname)) {
    addresses.push(hostname);
  } else {
    try {
      const results = await lookup(hostname, { all: true });
      for (const r of results) {
        addresses.push(r.address);
      }
    } catch {
      throw new Error("Could not resolve URL hostname");
    }
  }

  for (const address of addresses) {
    if (isPrivateAddress(address)) {
      throw new Error("URL points to a private network and is not allowed");
    }
  }
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const octets = address.split(".").map(Number);
    const [a, b] = octets as [number, number, number, number];
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    return false;
  }

  const lower = address.toLowerCase();
  if (lower === "::" || lower === "::1") return true; // unspecified / loopback
  if (lower.startsWith("fe80")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local fc00::/7
  if (lower.startsWith("::ffff:")) {
    // IPv4-mapped IPv6 — recurse into the IPv4 part
    const v4 = lower.slice("::ffff:".length);
    if (isIP(v4) === 4) return isPrivateAddress(v4);
  }
  return false;
}
