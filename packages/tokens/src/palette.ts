import { parseUtility } from "@tailwind-canonicalize/resolver";

const COLOR_PROPERTIES = new Set([
  "bg",
  "text",
  "border",
  "border-t",
  "border-r",
  "border-b",
  "border-l",
  "border-x",
  "border-y",
  "ring",
  "fill",
  "stroke",
  "outline",
  "from",
  "via",
  "to",
  "accent",
  "caret",
  "decoration",
  "divide",
]);

const PALETTE_NAMES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white|transparent|current";

const COLOR_BASE_RE = new RegExp(
  `^(${[...COLOR_PROPERTIES].join("|")})-(${PALETTE_NAMES})(?:-(\\d{2,3}))?$`,
);

const FONT_SIZES = new Set([
  "xs",
  "sm",
  "base",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "6xl",
  "7xl",
  "8xl",
  "9xl",
]);

/**
 * Parse a color utility into property + palette + shade.
 * Returns null when not a palette color utility.
 */
export function parseColorUtility(token: string): {
  base: string;
  property: string;
  palette: string;
  shade: string | null;
  variants: string;
  important: boolean;
} | null {
  const parts = parseUtility(token);
  const base = parts.base.startsWith("-") ? parts.base.slice(1) : parts.base;

  // Prefer full-base match so text-slate-800 is not split as text-slate + 800
  const m = base.match(COLOR_BASE_RE);
  if (m) {
    const property = m[1]!;
    const palette = m[2]!;
    const shade = m[3] ?? null;

    // text-sm etc.
    if (property === "text" && FONT_SIZES.has(palette)) {
      return null;
    }
    // border-2 numeric width
    if (property.startsWith("border") && /^\d+$/.test(palette)) {
      return null;
    }

    return {
      base,
      property,
      palette,
      shade,
      variants: parts.variants,
      important: parts.important,
    };
  }

  // Arbitrary colors are not palette migrations
  if (parts.isArbitrary) {
    return null;
  }

  return null;
}

export function isColorUtility(token: string): boolean {
  return parseColorUtility(token) !== null;
}
