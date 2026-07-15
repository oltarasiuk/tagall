import { createHash } from "node:crypto";
import sharp from "sharp";
import { MediaError } from "../../media/errors/media.error";
import type { MediaKindType } from "../../media/types";

/**
 * A last-resort cover produced entirely locally: no AI, no headless browser, no
 * network. A deterministic gradient + the title rendered to a small SVG and
 * encoded to WebP by the already-installed sharp. The same item always yields
 * the same cover, so re-adds are stable.
 */

const WIDTH = 600;
const HEIGHT = 900;
const OUTPUT_QUALITY = 85;

const MEDIA_LABELS: Record<MediaKindType, string> = {
  film: "Film",
  serie: "Series",
  book: "Book",
  manga: "Manga",
  comic: "Comic",
  "visual-novel": "Visual Novel",
  game: "Game",
  "board-game": "Board Game",
};

/** SVG is XML: user text must be escaped before it is inlined into the markup. */
const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

type Palette = { from: string; to: string; accent: string; direction: number };

/** Two or three HSL colours + a direction, fully determined by the item key. */
const paletteFromKey = (canonicalKey: string): Palette => {
  const hash = createHash("sha256").update(canonicalKey).digest();
  const byte = (index: number) => hash[index] ?? 0;

  const hue = Math.round((byte(0) / 255) * 360);
  const hue2 = Math.round((hue + 40 + (byte(1) / 255) * 120) % 360);
  const accentHue = Math.round((hue + 180) % 360);

  return {
    from: `hsl(${hue}, 62%, 32%)`,
    to: `hsl(${hue2}, 58%, 18%)`,
    accent: `hsl(${accentHue}, 70%, 60%)`,
    direction: Math.round((byte(2) / 255) * 90),
  };
};

/**
 * Greedy word wrap tuned to the canvas width. Long titles get a smaller font
 * and up to six lines; anything past that is truncated with an ellipsis so the
 * cover never overflows.
 */
const wrapTitle = (
  title: string,
  fontSize: number,
): { lines: string[]; fontSize: number } => {
  const trimmed = title.trim() || "Untitled";
  const maxChars = Math.max(8, Math.floor(WIDTH / (fontSize * 0.55)));
  const maxLines = 6;

  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word.length > maxChars ? `${word.slice(0, maxChars - 1)}…` : word;
    }
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);

  if (lines.length >= maxLines && words.join(" ").length > lines.join(" ").length) {
    const last = lines[maxLines - 1] ?? "";
    lines[maxLines - 1] = `${last.replace(/…$/, "").slice(0, maxChars - 1)}…`;
  }

  return { lines: lines.slice(0, maxLines), fontSize };
};

const buildSvg = (props: {
  title: string;
  mediaKind: MediaKindType;
  palette: Palette;
}): string => {
  const { title, mediaKind, palette } = props;

  const fontSize = title.length > 40 ? 44 : title.length > 22 ? 56 : 68;
  const { lines } = wrapTitle(title, fontSize);
  const lineHeight = fontSize * 1.2;
  const blockHeight = lines.length * lineHeight;
  const startY = HEIGHT / 2 - blockHeight / 2 + fontSize;

  const titleTspans = lines
    .map(
      (line, index) =>
        `<tspan x="${WIDTH / 2}" y="${Math.round(startY + index * lineHeight)}">${escapeXml(line)}</tspan>`,
    )
    .join("");

  const label = escapeXml(MEDIA_LABELS[mediaKind] ?? "Item");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" gradientTransform="rotate(${palette.direction})">
      <stop offset="0%" stop-color="${palette.from}"/>
      <stop offset="100%" stop-color="${palette.to}"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect x="0" y="0" width="${WIDTH}" height="10" fill="${palette.accent}"/>
  <rect x="0" y="${HEIGHT - 10}" width="${WIDTH}" height="10" fill="${palette.accent}"/>
  <text text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${fontSize}" fill="#ffffff">${titleTspans}</text>
  <text x="${WIDTH / 2}" y="${HEIGHT - 48}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="600" font-size="26" fill="${palette.accent}" letter-spacing="4">${label.toUpperCase()}</text>
</svg>`;
};

/** Renders the deterministic cover to a validated WebP buffer. No network I/O. */
export async function generateCoverBuffer(props: {
  canonicalKey: string;
  title: string;
  mediaKind: MediaKindType;
}): Promise<Buffer> {
  const { canonicalKey, title, mediaKind } = props;

  try {
    const svg = buildSvg({
      title,
      mediaKind,
      palette: paletteFromKey(canonicalKey),
    });

    return await sharp(Buffer.from(svg))
      .webp({ quality: OUTPUT_QUALITY })
      .toBuffer();
  } catch (error) {
    throw new MediaError(
      "ARTWORK_GENERATION_FAILED",
      "Failed to render a generated cover",
      { cause: error },
    );
  }
}
