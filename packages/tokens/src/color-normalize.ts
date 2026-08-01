/**
 * Normalize CSS colors for exact equality comparison.
 * Does not treat "close" colors as equal.
 */

export function normalizeColor(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, " ");

  // hex
  if (s.startsWith("#")) {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) {
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    }
    if (h.length === 8 && h.endsWith("ff")) {
      h = h.slice(0, 6);
    }
    if (h.length === 6 || h.length === 8) {
      return `#${h}`;
    }
    return null;
  }

  // rgb/rgba
  const rgb = s.match(
    /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/,
  );
  if (rgb) {
    const r = clamp255(Number(rgb[1]));
    const g = clamp255(Number(rgb[2]));
    const b = clamp255(Number(rgb[3]));
    const a = rgb[4] !== undefined ? parseAlpha(rgb[4]) : 1;
    if (a < 1) {
      return `rgba(${r},${g},${b},${a})`;
    }
    return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  }

  // space-separated rgb(255 255 255)
  const rgbSpace = s.match(
    /^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/,
  );
  if (rgbSpace) {
    const r = clamp255(Number(rgbSpace[1]));
    const g = clamp255(Number(rgbSpace[2]));
    const b = clamp255(Number(rgbSpace[3]));
    const a = rgbSpace[4] !== undefined ? parseAlpha(rgbSpace[4]) : 1;
    if (a < 1) {
      return `rgba(${r},${g},${b},${a})`;
    }
    return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  }

  // named
  const named: Record<string, string> = {
    white: "#ffffff",
    black: "#000000",
    transparent: "transparent",
    currentcolor: "currentcolor",
    inherit: "inherit",
  };
  if (named[s]) {
    return named[s]!;
  }

  // hsl — keep normalized string (exact match only)
  if (s.startsWith("hsl") || s.startsWith("oklch") || s.startsWith("oklab")) {
    return s.replace(/\s+/g, "");
  }

  return `raw:${s}`;
}

export function colorsEqual(a: string, b: string): boolean {
  const na = normalizeColor(a);
  const nb = normalizeColor(b);
  if (na === null || nb === null) {
    return false;
  }
  return na === nb;
}

function clamp255(n: number): number {
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hex2(n: number): string {
  return n.toString(16).padStart(2, "0");
}

function parseAlpha(raw: string): number {
  if (raw.endsWith("%")) {
    return Number(raw.slice(0, -1)) / 100;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : 1;
}
