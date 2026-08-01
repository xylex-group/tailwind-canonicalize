import { createDefaultTheme } from "./default-theme.js";
import {
  formatScaleKey,
  invertSpacingMultiplier,
  valuesEqual,
} from "./length.js";
import {
  alternateScales,
  KEYWORD_MAP,
  normalizeEaseValue,
  scaleForNamespace,
} from "./namespace.js";
import { arbitraryInner, formatUtility, parseUtility } from "./parse-utility.js";
import type {
  CanonicalMatch,
  FindCanonicalOptions,
  Theme,
  ThemeScale,
  UtilityParts,
} from "./types.js";

/**
 * Find a single safe canonical equivalent for a utility class token.
 *
 * Safety contract:
 * - Never rewrite arbitrary properties `[prop:value]`
 * - Never rewrite calc()/var() arbitrary values
 * - Rewrite only when exactly one candidate theme key matches
 * - Preserve variants and important flags
 */
export function findCanonicalEquivalent(
  token: string,
  options: FindCanonicalOptions = {},
): CanonicalMatch | null {
  const theme = options.theme ?? createDefaultTheme();
  const rootFontSizePx = options.rootFontSizePx ?? 16;
  const cache = options.cache;
  const cacheKey = token;

  if (cache?.has(cacheKey)) {
    return cache.get(cacheKey) ?? null;
  }

  const result = findCanonicalUncached(token, theme, rootFontSizePx, options);
  cache?.set(cacheKey, result);
  return result;
}

function findCanonicalUncached(
  token: string,
  theme: Theme,
  rootFontSizePx: number,
  options: FindCanonicalOptions,
): CanonicalMatch | null {
  const parts = parseUtility(token);

  // Already non-arbitrary named utility — nothing to do for now
  // (future: collapse redundant forms). Safety first: skip.
  if (!parts.isArbitrary) {
    return null;
  }

  if (parts.isArbitraryProperty) {
    return null;
  }

  const innerRaw = arbitraryInner(parts.value);
  if (innerRaw === null) {
    return null;
  }

  // Never rewrite calc/var/min/max/clamp
  if (isUnsafeValue(innerRaw)) {
    return null;
  }

  // Negative length inside arbitrary: top-[-20px] → -top-5
  let inner = innerRaw;
  let forceNegative = parts.negative;
  if (inner.startsWith("-") && /^-[\d.]/.test(inner)) {
    forceNegative = true;
    inner = inner.slice(1);
  }

  const partsForFormat: UtilityParts = {
    ...parts,
    negative: forceNegative,
  };

  // Keyword map (exact string match on inner; ease uses normalized bezier)
  const keywordLookup =
    parts.namespace === "ease"
      ? normalizeEaseValue(inner)
      : inner.toLowerCase();
  const keywordSuffix = KEYWORD_MAP[parts.namespace]?.[keywordLookup];
  if (keywordSuffix) {
    return buildMatch(partsForFormat, keywordSuffix, "keyword", [keywordSuffix]);
  }

  // z-[5] → z-5 (bare unitless integer; Tailwind v4 IntelliSense)
  if (parts.namespace === "z") {
    const zBare = matchBareZIndex(inner);
    if (zBare !== null) {
      return buildMatch(partsForFormat, zBare, "keyword", [zBare]);
    }
  }

  const scales = collectScales(parts.namespace, theme);
  const matchedSuffixes: string[] = [];

  for (const scale of scales) {
    for (const [key, cssValue] of scale.values) {
      if (valuesEqual(inner, cssValue, rootFontSizePx)) {
        matchedSuffixes.push(key === "DEFAULT" ? "" : key);
      }
    }
  }

  let unique = [...new Set(matchedSuffixes)];

  // Continuous spacing: any exact multiple of --spacing (e.g. w-[140px] ? w-35)
  // Prefer discrete/named theme hits above; only fall back when none matched.
  // v4-only: v3 themes populate spacingUnit but lack continuous bare keys.
  // Border widths use raw px numbers, not --spacing multipliers.
  if (
    unique.length === 0 &&
    theme.spacingUnit &&
    theme.tailwindVersion !== 3 &&
    scaleForNamespace(parts.namespace, theme) === theme.spacing &&
    allowsContinuousSpacingInvert(parts.namespace)
  ) {
    const mult = invertSpacingMultiplier(
      inner,
      theme.spacingUnit,
      rootFontSizePx,
    );
    if (mult !== null) {
      const key = formatScaleKey(mult);
      const explicit = theme.spacing.values.get(key);
      // Reject when theme defines this key to a different absolute length.
      if (
        explicit === undefined ||
        valuesEqual(inner, explicit, rootFontSizePx)
      ) {
        unique = [key];
      }
    }
  }

  // Optional strict compile verification: drop candidates that don't compile equal
  if (options.compileEqual && unique.length > 0) {
    const verified: string[] = [];
    for (const suffix of unique) {
      const candidate = buildMatch(partsForFormat, suffix, "theme-exact", [suffix]);
      const equal = options.compileEqual(token, candidate.canonical);
      // sync only path for findCanonical; async compileEqual must be pre-bound sync wrapper
      if (equal === true) {
        verified.push(suffix);
      } else if (equal instanceof Promise) {
        // Async not supported in sync findCanonical — treat as theme-exact only
        verified.push(suffix);
      }
    }
    if (options.strictCompile) {
      unique = verified;
    } else if (verified.length === 1) {
      // Prefer compile-proven single match when available
      unique = verified;
    }
  }

  if (unique.length === 0) {
    return null;
  }

  if (unique.length > 1) {
    if (options.allowAmbiguous) {
      unique.sort((a, b) => {
        const score = (s: string) => {
          if (s.includes("/")) {
            return 100 + s.length;
          }
          return s.length;
        };
        return score(a) - score(b);
      });
      return buildMatch(partsForFormat, unique[0]!, "theme-exact", unique);
    }
    const preferred = preferCanonical(unique);
    if (preferred !== null) {
      return buildMatch(partsForFormat, preferred, "theme-exact", unique);
    }
    return null;
  }

  const reason =
    options.compileEqual && options.strictCompile ? "compile-equal" : "theme-exact";
  return buildMatch(partsForFormat, unique[0]!, reason, unique);
}

function preferCanonical(suffixes: string[]): string | null {
  const fractionPref = [
    "1/2",
    "1/3",
    "2/3",
    "1/4",
    "3/4",
    "1/5",
    "2/5",
    "3/5",
    "4/5",
    "1/6",
    "5/6",
    "1/12",
    "5/12",
    "7/12",
    "11/12",
  ];
  const fracs = suffixes.filter((s) => s.includes("/"));
  const nonFracs = suffixes.filter((s) => !s.includes("/"));

  if (nonFracs.length === 1 && fracs.length >= 1) {
    return nonFracs[0]!;
  }

  if (fracs.length > 0 && nonFracs.length === 0) {
    for (const p of fractionPref) {
      if (fracs.includes(p)) {
        return p;
      }
    }
  }

  const named = nonFracs.filter((s) => s !== "" && !/^\d+(\.\d+)?$/.test(s));
  const numeric = nonFracs.filter((s) => /^\d+(\.\d+)?$/.test(s));
  if (named.length === 1 && numeric.length > 0) {
    return named[0]!;
  }

  if (nonFracs.includes("") && nonFracs.length === 2) {
    return "";
  }

  if (nonFracs.length === 1) {
    return nonFracs[0]!;
  }

  return null;
}

function collectScales(namespace: string, theme: Theme): ThemeScale[] {
  const primary = scaleForNamespace(namespace, theme);
  const alts = alternateScales(namespace, theme);
  const scales: ThemeScale[] = [];
  if (primary) {
    scales.push(primary);
  }
  for (const a of alts) {
    if (!scales.includes(a)) {
      scales.push(a);
    }
  }
  return scales;
}

function isUnsafeValue(inner: string): boolean {
  const v = inner.toLowerCase();
  if (
    v.includes("calc(") ||
    v.includes("var(") ||
    v.includes("min(") ||
    v.includes("max(") ||
    v.includes("clamp(") ||
    v.includes("url(") ||
    v.includes("attr(")
  ) {
    return true;
  }
  return false;
}

/** Bare unitless z-index integers (and reject non-integers / lengths). */
function matchBareZIndex(inner: string): string | null {
  const trimmed = inner.trim().toLowerCase();
  if (trimmed === "auto") {
    return "auto";
  }
  // Only pure integers — not 5px, not 1.5, not calc
  if (!/^-?\d+$/.test(trimmed)) {
    return null;
  }
  return String(Number(trimmed));
}

function buildMatch(
  parts: UtilityParts,
  suffix: string,
  reason: CanonicalMatch["reason"],
  matched: string[],
): CanonicalMatch {
  const canonicalBase =
    suffix === ""
      ? `${parts.negative ? "-" : ""}${parts.namespace}`
      : formatUtility(
          {
            variants: "",
            important: false,
            negative: parts.negative,
            namespace: parts.namespace,
          },
          suffix,
        );

  const canonical = formatUtility(
    {
      variants: parts.variants,
      important: parts.important,
      negative: parts.negative,
      namespace: parts.namespace,
    },
    suffix,
  );

  return {
    canonical,
    canonicalBase,
    reason,
    matchedCandidates: matched,
  };
}

/**
 * Public helper: canonicalize a single class token or return the original.
 */
export function canonicalizeClass(
  token: string,
  options: FindCanonicalOptions = {},
): string {
  return findCanonicalEquivalent(token, options)?.canonical ?? token;
}

/**
 * Canonicalize a list of class tokens.
 */
export function canonicalizeClasses(
  tokens: string[],
  options: FindCanonicalOptions = {},
): string[] {
  return tokens.map((t) => canonicalizeClass(t, options));
}

/** Namespaces whose bare numeric utilities are --spacing multipliers (not border px widths). */
function allowsContinuousSpacingInvert(namespace: string): boolean {
  if (namespace === "border-spacing" || namespace.startsWith("border-spacing-")) {
    return true;
  }
  // border / border-t / border-x etc. bare numbers are pixel widths in Tailwind.
  if (namespace === "border" || namespace.startsWith("border-")) {
    return false;
  }
  return true;
}
