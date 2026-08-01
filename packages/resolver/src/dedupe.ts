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
 *
 * `detectConflicts` and `collapseEquivalent` are independent: conflicts are
 * still reported when collapse is disabled.
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

  // Second pass: equivalent competitors and/or conflict diagnostics.
  // Runs when either collapse or detection is enabled so the flags stay independent.
  if (collapseEquivalent || detectConflicts) {
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
          if (collapseEquivalent) {
            b.drop = true;
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

        const ca =
          findCanonicalEquivalent(a.token, options)?.canonical ?? a.token;
        const cb =
          findCanonicalEquivalent(b.token, options)?.canonical ?? b.token;

        const aIsArb = a.token.includes("[");
        const bIsArb = b.token.includes("[");
        const equivalent = ca === cb || ca === b.token || cb === a.token;

        if (collapseEquivalent && equivalent) {
          // Capture originals BEFORE any mutation
          const originalA = a.token;
          const originalB = b.token;

          if (aIsArb && !bIsArb) {
            a.drop = true;
            transformations.push({
              category: "duplicate-token-removal",
              original: `${originalA} ${originalB}`,
              replacement: originalB,
              confidence: "exact",
              safety: "safe",
              notes: "Collapsed equivalent utilities; kept named form",
            });
          } else if (!aIsArb && bIsArb) {
            b.drop = true;
            transformations.push({
              category: "duplicate-token-removal",
              original: `${originalA} ${originalB}`,
              replacement: originalA,
              confidence: "exact",
              safety: "safe",
              notes: "Collapsed equivalent utilities; kept named form",
            });
          } else if (ca === cb) {
            b.drop = true;
            if (a.token !== ca) {
              transformations.push({
                category: "canonical-class",
                original: originalA,
                replacement: ca,
                confidence: "exact",
                safety: "safe",
              });
              a.token = ca;
            }
            transformations.push({
              category: "duplicate-token-removal",
              original: originalB,
              replacement: "",
              confidence: "exact",
              safety: "safe",
            });
          }
          continue;
        }

        // True conflict — different values, same slot (independent of collapse)
        if (detectConflicts && !equivalent) {
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
