export type LengthUnit = "px" | "rem" | "em" | "%" | "vh" | "vw" | "svh" | "dvh" | "lvh" | "number";

export interface ParsedLength {
  value: number;
  unit: LengthUnit;
  raw: string;
}

export interface ThemeScale {
  /** Map of utility suffix → raw CSS value (e.g. "4" → "1rem", "full" → "100%"). */
  values: Map<string, string>;
}

export interface Theme {
  /** Base spacing unit (Tailwind v4 default: 0.25rem). */
  spacingUnit: ParsedLength | null;
  spacing: ThemeScale;
  colors: ThemeScale;
  borderRadius: ThemeScale;
  fontSize: ThemeScale;
  lineHeight: ThemeScale;
  letterSpacing: ThemeScale;
  blur: ThemeScale;
  boxShadow: ThemeScale;
  opacity: ThemeScale;
  width: ThemeScale;
  height: ThemeScale;
  /** Raw CSS variables from @theme. */
  cssVariables: Map<string, string>;
  /** Source of the theme for diagnostics. */
  source: "default" | "css" | "merged";
  /**
   * Major Tailwind version this theme targets.
   * Continuous spacing-key synthesis is v4-only (v3 has a discrete scale).
   */
  tailwindVersion: 3 | 4;
}

export interface UtilityParts {
  /** Full original token, e.g. `hover:md:w-[40px]!` */
  original: string;
  /** Variant prefixes including trailing colons joined, e.g. `hover:md:` */
  variants: string;
  /** Whether important `!` is present (leading or trailing). */
  important: boolean;
  /** Base utility without variants/important, e.g. `w-[40px]` or `-top-[20px]` */
  base: string;
  /** Negative prefix on the utility itself. */
  negative: boolean;
  /** Property-ish prefix, e.g. `w`, `min-w`, `rounded-t`, `text` */
  namespace: string;
  /** Value portion, e.g. `[40px]`, `10`, `1/2` */
  value: string;
  /** True when value is arbitrary `[...]`. */
  isArbitrary: boolean;
  /** True for arbitrary properties `[mask-image:...]`. */
  isArbitraryProperty: boolean;
}

export type EquivalenceReason =
  | "theme-exact"
  | "keyword"
  | "fraction"
  | "compile-equal"
  | "none";

export interface CanonicalMatch {
  /** Canonical utility including variants and important. */
  canonical: string;
  /** Base canonical without variants, e.g. `w-10` */
  canonicalBase: string;
  reason: EquivalenceReason;
  /** All candidates that matched (must be length 1 for a rewrite). */
  matchedCandidates: string[];
}

export interface ResolveOptions {
  theme?: Theme;
  /**
   * Root font size used when comparing px ↔ rem. Default 16.
   * Only applied when both sides are absolute lengths.
   */
  rootFontSizePx?: number;
  /**
   * Prefer shorter names when multiple keys map to the same value
   * after normalization? Default: leave untouched (safe).
   * When false (default), multi-match ⇒ no rewrite.
   */
  allowAmbiguous?: boolean;
  /**
   * Optional compile comparator. Given two full class names, returns
   * whether their generated CSS declarations are identical.
   * Prefer a sync wrapper around a cached Tailwind compile.
   */
  compileEqual?: (a: string, b: string) => boolean | Promise<boolean>;
  /**
   * When true with compileEqual, only rewrite candidates that compile equal.
   * When false (default), theme-exact matches still apply; compile can refine multi-match.
   */
  strictCompile?: boolean;
}

export interface FindCanonicalOptions extends ResolveOptions {
  /** Cache key namespace. */
  cache?: Map<string, CanonicalMatch | null>;
}
