import type { ClassStringDiagnostic, TransformationRecord } from "./categories.js";
import { findCanonicalEquivalent } from "./find-canonical.js";
import type { FindCanonicalOptions } from "./types.js";
import { utilitiesConflict, utilityIdentity } from "./utility-identity.js";

export interface DedupeOptions extends FindCanonicalOptions {
  /** Remove exact duplicate utilities (same identity). Default true. */
  removeDuplicates?: boolean;
  /** Detect conflicting utilities in the same group. Default true. */
  detectConflicts?: boolean;
  /**
   * When two utilities in the same slot are equivalent after canonicalization,
   * keep the preferred (non-arbitrary) one. Default true in safe mode.
   */
  collapseEquivalent?: boolean;
}

/**
 * Remove duplicate / equivalent competing utilities; report true conflicts.
 *
 * Variant-aware: `bg-white` and `hover:bg-white` never collapse.
 */
export function dedupeClassTokens(
  tokens: string[],
  options: DedupeOptions = {},
): {
  tokens: string[];
  transformations: TransformationRecord[];
  diagnostics: ClassStringDiagnostic[];
} {
  const removeDuplicates = options.removeDuplicates !== false;
  const detectConflicts = options.detectConflicts !== false;
  const collapseEquivalent = options.collapseEquivalent !== false;

  const transformations: TransformationRecord[] = [];
  const diagnostics: ClassStringDiagnostic[] = [];

  // Work on non-whitespace tokens only; caller preserves layout
  type Entry = { token: string; index: number; drop: boolean };
  const entries: Entry[] = tokens.map((token, index) => ({
    token,
    index,
    drop: false,
  }));

  // First pass: exact normalized identity duplicates → keep first
  if (removeDuplicates) {
    const seen = new Map<string, number>();
    for (const entry of entries) {
      const id = utilityIdentity(entry.token);
      const key = `${id.variants.join(":")}|${id.important}|${id.propertyGroup}|${id.value}|${entry.token}`;
      // Prefer full token equality for exact dups
      const exactKey = `${id.variants.join(":")}|${id.important}|${entry.token}`;
      if (seen.has(exactKey)) {
        entry.drop = true;
        transformations.push({
          category: "duplicate-token-removal",
          original: entry.token,
          replacement: "",
          confidence: "exact",
          safety: "safe",
          notes: "Removed exact duplicate utility",
        });
      } else {
        seen.set(exactKey, entry.index);
      }
    }
  }

  // Second pass: equivalent competitors (e.g. max-w-40 max-w-[160px])
  if (collapseEquivalent) {
    for (let i = 0; i < entries.length; i++) {
      const a = entries[i]!;
      if (a.drop) {
        continue;
      }
      for (let j = i + 1; j < entries.length; j++) {
        const b = entries[j]!;
        if (b.drop) {
          continue;
        }
        if (!utilitiesConflict(a.token, b.token)) {
          continue;
        }
        if (a.token === b.token) {
          b.drop = true;
          transformations.push({
            category: "duplicate-token-removal",
            original: b.token,
            replacement: "",
            confidence: "exact",
            safety: "safe",
          });
          continue;
        }

        // Canonicalize both; if they resolve to the same class, keep non-arbitrary / first
        const ca = findCanonicalEquivalent(a.token, options)?.canonical ?? a.token;
        const cb = findCanonicalEquivalent(b.token, options)?.canonical ?? b.token;

        // Also consider if one is already the canonical form of the other
        const aIsArb = a.token.includes("[");
        const bIsArb = b.token.includes("[");

        if (ca === cb || ca === b.token || cb === a.token) {
          // Prefer non-arbitrary, else keep earlier (source order loser drops)
          if (aIsArb && !bIsArb) {
            a.drop = true;
            a.token = b.token;
            transformations.push({
              category: "duplicate-token-removal",
              original: `${entries[i]!.token} ${b.token}`,
              replacement: b.token,
              confidence: "exact",
              safety: "safe",
              notes: "Collapsed equivalent utilities; kept named form",
            });
            // restore: drop a, keep b
            entries[i]!.drop = true;
            entries[i]!.token = entries[i]!.token;
          } else if (!aIsArb && bIsArb) {
            b.drop = true;
            transformations.push({
              category: "duplicate-token-removal",
              original: `${a.token} ${b.token}`,
              replacement: a.token,
              confidence: "exact",
              safety: "safe",
              notes: "Collapsed equivalent utilities; kept named form",
            });
          } else if (ca === cb) {
            b.drop = true;
            // Optionally rewrite a to canonical
            if (a.token !== ca) {
              transformations.push({
                category: "canonical-class",
                original: a.token,
                replacement: ca,
                confidence: "exact",
                safety: "safe",
              });
              a.token = ca;
            }
            transformations.push({
              category: "duplicate-token-removal",
              original: b.token,
              replacement: "",
              confidence: "exact",
              safety: "safe",
            });
          }
          continue;
        }

        // True conflict — different values, same slot
        if (detectConflicts) {
          diagnostics.push({
            kind: "conflict",
            message: `Conflicting ${utilityIdentity(a.token).propertyGroup} utilities: ${a.token} and ${b.token}. The latter currently wins through source order. No automatic resolution applied.`,
            utilities: [a.token, b.token],
          });
        }
      }
    }
  }

  const next = entries.filter((e) => !e.drop).map((e) => e.token);
  return { tokens: next, transformations, diagnostics };
}
