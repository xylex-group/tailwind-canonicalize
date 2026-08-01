import type { TransformationRecord } from "./categories.js";
import { parseUtility } from "./parse-utility.js";
import { utilityIdentity } from "./utility-identity.js";

/**
 * Approved light/dark palette pair that collapses to one semantic utility
 * only when both theme sides are present and proven.
 */
export interface ThemePairMapping {
  /** Light-mode utility base, e.g. `bg-white` */
  light: string;
  /** Dark-mode utility base (without `dark:`), e.g. `bg-slate-950` */
  dark: string;
  /** Semantic target base, e.g. `bg-background` */
  target: string;
  token?: string;
  /**
   * When true, the pair has been proven against theme token light+dark values.
   * Default true for explicit manifest pairs (user-approved).
   */
  proven?: boolean;
}

export interface DarkPairOptions {
  pairs?: ThemePairMapping[];
  /** Only collapse when proven !== false. Default true. */
  requireProven?: boolean;
}

/**
 * Collapse `bg-white dark:bg-slate-950` → `bg-background` when approved.
 *
 * Rules:
 * - Both light base and `dark:` + dark base must appear
 * - Same important flag on both (or only one important)
 * - No other non-dark variants on either token (except the dark: on the dark side)
 * - Pair must be proven (manifest-approved or dual-theme token proof)
 * - Replacements are always literal static class names (never interpolated)
 */
export function collapseDarkPairs(
  tokens: string[],
  options: DarkPairOptions = {},
): {
  tokens: string[];
  transformations: TransformationRecord[];
} {
  const pairs = options.pairs ?? [];
  if (pairs.length === 0) {
    return { tokens, transformations: [] };
  }

  const requireProven = options.requireProven !== false;
  const transformations: TransformationRecord[] = [];
  const drop = new Set<number>();
  const replace = new Map<number, string>();

  for (const pair of pairs) {
    if (requireProven && pair.proven === false) {
      continue;
    }

    // Find candidates
    const lightIdx: number[] = [];
    const darkIdx: number[] = [];

    for (let i = 0; i < tokens.length; i++) {
      if (drop.has(i)) {
        continue;
      }
      const t = tokens[i]!;
      const parts = parseUtility(t);
      const base = parts.base.startsWith("-") ? parts.base.slice(1) : parts.base;
      const variants = parts.variants.endsWith(":")
        ? parts.variants.slice(0, -1).split(":").filter(Boolean)
        : [];

      if (base === pair.light && variants.length === 0) {
        lightIdx.push(i);
      }
      if (
        base === pair.dark &&
        variants.length === 1 &&
        variants[0] === "dark"
      ) {
        darkIdx.push(i);
      }
    }

    // Pair each light with a dark (greedy left-to-right)
    const usedDark = new Set<number>();
    for (const li of lightIdx) {
      if (drop.has(li)) {
        continue;
      }
      const lightToken = tokens[li]!;
      const lightParts = parseUtility(lightToken);
      const di = darkIdx.find((d) => {
        if (usedDark.has(d) || drop.has(d)) {
          return false;
        }
        const darkParts = parseUtility(tokens[d]!);
        return darkParts.important === lightParts.important;
      });
      if (di === undefined) {
        continue;
      }
      usedDark.add(di);

      let target = pair.target;
      if (lightParts.important) {
        target = `${target}!`;
      }

      replace.set(li, target);
      drop.add(di);

      transformations.push({
        category: "semantic-color-token",
        original: `${lightToken} ${tokens[di]}`,
        replacement: target,
        token: pair.token,
        confidence: "exact",
        safety: "safe",
        notes: "Collapsed light/dark pair into semantic token (both themes proven/approved)",
      });
    }
  }

  const next: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (drop.has(i)) {
      continue;
    }
    next.push(replace.get(i) ?? tokens[i]!);
  }

  // Drop exact dups introduced (bg-background bg-background)
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const t of next) {
    const id = utilityIdentity(t);
    const key = `${id.variants.join(":")}|${id.important}|${t}`;
    if (seen.has(key)) {
      transformations.push({
        category: "duplicate-token-removal",
        original: t,
        replacement: "",
        confidence: "exact",
        safety: "safe",
        notes: "Removed duplicate after dark-pair collapse",
      });
      continue;
    }
    seen.add(key);
    deduped.push(t);
  }

  return { tokens: deduped, transformations };
}

/**
 * Prove a theme pair against token light/dark values when palette resolution is known.
 */
export function proveThemePair(
  pair: ThemePairMapping,
  tokenValues: { light?: string; dark?: string } | undefined,
  resolveUtilityColor: (base: string) => string | null,
): boolean {
  if (!tokenValues?.light || !tokenValues?.dark) {
    return false;
  }
  const lightCss = resolveUtilityColor(pair.light);
  const darkCss = resolveUtilityColor(pair.dark);
  if (!lightCss || !darkCss) {
    return false;
  }
  return (
    normalizeSimple(lightCss) === normalizeSimple(tokenValues.light) &&
    normalizeSimple(darkCss) === normalizeSimple(tokenValues.dark)
  );
}

function normalizeSimple(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, "");
}
