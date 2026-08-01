import type { LengthUnit, ParsedLength } from "./types.js";

const LENGTH_RE =
  /^(-?(?:\d+(?:\.\d+)?|\.\d+))(px|rem|em|%|vh|vw|svh|dvh|lvh)?$/i;

/**
 * Parse a CSS length or number. Returns null for calc(), var(), or unknown.
 */
export function parseLength(raw: string): ParsedLength | null {
  const trimmed = raw.trim().toLowerCase();
  if (
    trimmed.includes("calc(") ||
    trimmed.includes("var(") ||
    trimmed.includes("min(") ||
    trimmed.includes("max(") ||
    trimmed.includes("clamp(")
  ) {
    return null;
  }

  if (trimmed === "0") {
    return { value: 0, unit: "number", raw: trimmed };
  }

  const m = trimmed.match(LENGTH_RE);
  if (!m) {
    return null;
  }
  const value = Number(m[1]);
  if (!Number.isFinite(value)) {
    return null;
  }
  const unit = (m[2]?.toLowerCase() ?? "number") as LengthUnit;
  return { value, unit, raw: trimmed };
}

/**
 * Convert a length to px for comparison, when possible.
 * rem/em use rootFontSizePx (default 16).
 * Returns null when units are incompatible (e.g. % vs px).
 */
export function toPx(length: ParsedLength, rootFontSizePx = 16): number | null {
  switch (length.unit) {
    case "px":
    case "number":
      return length.value;
    case "rem":
    case "em":
      return length.value * rootFontSizePx;
    default:
      return null;
  }
}

/**
 * Normalize two CSS values for exact semantic comparison.
 * Returns a canonical comparison key, or null if either side is non-comparable.
 */
export function normalizeCssValue(
  raw: string,
  rootFontSizePx = 16,
): string | null {
  const trimmed = raw.trim().toLowerCase().replace(/\s+/g, " ");

  // Keywords
  if (
    [
      "auto",
      "none",
      "full",
      "fit-content",
      "min-content",
      "max-content",
      "inherit",
      "currentcolor",
      "transparent",
    ].includes(trimmed)
  ) {
    return `kw:${trimmed === "currentcolor" ? "currentcolor" : trimmed}`;
  }

  // Percentages — keep exact
  if (trimmed.endsWith("%")) {
    const n = Number(trimmed.slice(0, -1));
    if (!Number.isFinite(n)) {
      return null;
    }
    return `pct:${n}`;
  }

  // Viewport units — keep unit family
  const vh = trimmed.match(/^(-?(?:\d+(?:\.\d+)?|\.\d+))(vh|svh|dvh|lvh|vw)$/);
  if (vh) {
    return `vp:${vh[1]}${vh[2]}`;
  }

  const len = parseLength(trimmed);
  if (!len) {
    // Colors: normalize hex
    if (/^#([0-9a-f]{3,8})$/i.test(trimmed)) {
      return `color:${normalizeHex(trimmed)}`;
    }
    // rgb/hsl leave as-is normalized whitespace
    if (/^(rgb|rgba|hsl|hsla|oklch|oklab|color)\(/i.test(trimmed)) {
      return `color:${trimmed.replace(/\s+/g, "")}`;
    }
    return `raw:${trimmed}`;
  }

  if (len.unit === "%") {
    return `pct:${len.value}`;
  }

  const px = toPx(len, rootFontSizePx);
  if (px === null) {
    return `${len.unit}:${len.value}`;
  }
  // Use high precision to avoid float noise, but allow 0.001px tolerance via rounding
  return `px:${round(px, 6)}`;
}

export function valuesEqual(
  a: string,
  b: string,
  rootFontSizePx = 16,
): boolean {
  const na = normalizeCssValue(a, rootFontSizePx);
  const nb = normalizeCssValue(b, rootFontSizePx);
  if (na === null || nb === null) {
    return false;
  }
  return na === nb;
}

function normalizeHex(hex: string): string {
  let h = hex.slice(1).toLowerCase();
  if (h.length === 3 || h.length === 4) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length === 8 && h.endsWith("ff")) {
    h = h.slice(0, 6);
  }
  return `#${h}`;
}

function round(n: number, digits: number): number {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

/**
 * Resolve Tailwind v4 spacing multiplier: calc(var(--spacing) * N)
 * against a known spacing unit.
 */
export function resolveSpacingMultiplier(
  multiplier: number,
  spacingUnit: ParsedLength,
  rootFontSizePx = 16,
): string {
  const unitPx = toPx(spacingUnit, rootFontSizePx);
  if (unitPx !== null) {
    const px = unitPx * multiplier;
    // Prefer rem when unit is rem
    if (spacingUnit.unit === "rem" || spacingUnit.unit === "em") {
      const rem = px / rootFontSizePx;
      return `${trimNum(rem)}rem`;
    }
    return `${trimNum(px)}px`;
  }
  return `${trimNum(spacingUnit.value * multiplier)}${spacingUnit.unit === "number" ? "" : spacingUnit.unit}`;
}

function trimNum(n: number): string {
  if (Number.isInteger(n)) {
    return String(n);
  }
  return String(round(n, 6));
}
