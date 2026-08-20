import type { LengthUnit, ParsedLength } from "./types.js";

const LENGTH_RE = /^(-?(?:\d+(?:\.\d+)?|\.\d+))(px|rem|em|%|vh|vw|svh|dvh|lvh)?$/i;

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
export function normalizeCssValue(raw: string, rootFontSizePx = 16): string | null {
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

export function valuesEqual(a: string, b: string, rootFontSizePx = 16): boolean {
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

/**
 * Inverse of resolveSpacingMultiplier: if `raw` is an exact multiple of the
 * spacing unit, return that multiplier; otherwise null.
 *
 * Mirrors Tailwind v4 IntelliSense continuous scale (any N where value =
 * calc(var(--spacing) * N)), not only the classic discrete key table.
 */
export function invertSpacingMultiplier(
  raw: string,
  spacingUnit: ParsedLength,
  rootFontSizePx = 16,
): number | null {
  const len = parseLength(raw);
  if (!len) {
    return null;
  }
  // Context-relative em cannot be equated to absolute/root-relative lengths
  // (e.g. --spacing: 0.25em vs w-[140px] is not a fixed multiplier).
  if ((len.unit === "em") !== (spacingUnit.unit === "em")) {
    return null;
  }
  // Both em: compare in em space without rootFontSizePx conversion
  if (len.unit === "em" && spacingUnit.unit === "em") {
    if (spacingUnit.value === 0) {
      return null;
    }
    const mult = len.value / spacingUnit.value;
    if (!Number.isFinite(mult) || mult < 0) {
      return null;
    }
    const snapped = round(mult, 6);
    const reconstructed = spacingUnit.value * snapped;
    const absTol = 1e-6;
    const relTol = 1e-9 * Math.max(Math.abs(len.value), Math.abs(reconstructed), 1);
    if (Math.abs(reconstructed - len.value) > absTol + relTol) {
      return null;
    }
    return snapped;
  }
  const valuePx = toPx(len, rootFontSizePx);
  const unitPx = toPx(spacingUnit, rootFontSizePx);
  if (valuePx === null || unitPx === null || unitPx === 0) {
    return null;
  }
  // Zero length is always multiplier 0
  if (valuePx === 0) {
    return 0;
  }
  const mult = valuePx / unitPx;
  if (!Number.isFinite(mult) || mult < 0) {
    return null;
  }
  // Snap to 6 decimal places then verify exact reconstruction
  const snapped = round(mult, 6);
  const reconstructed = unitPx * snapped;
  const absTol = 1e-6;
  const relTol = 1e-9 * Math.max(Math.abs(valuePx), Math.abs(reconstructed), 1);
  if (Math.abs(reconstructed - valuePx) > absTol + relTol) {
    return null;
  }
  return snapped;
}

/** Format a spacing scale key without trailing zeros (`3.25`, `62.5`, `40`). */
export function formatScaleKey(multiplier: number): string {
  return trimNum(multiplier);
}

function trimNum(n: number): string {
  if (Number.isInteger(n)) {
    return String(n);
  }
  // Avoid scientific notation; strip trailing zeros from fixed decimals
  const s = String(round(n, 6));
  if (!s.includes(".")) {
    return s;
  }
  return s.replace(/\.?0+$/, "");
}
