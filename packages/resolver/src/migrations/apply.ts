import type { TransformationRecord } from "../categories.js";
import { formatUtility, parseUtility } from "../parse-utility.js";
import {
  buildMigrationIndex,
  filterMigrations,
  TAILWIND_MIGRATIONS,
  type TailwindMigration,
} from "./registry.js";

export interface ApplyMigrationOptions {
  migrations?: readonly TailwindMigration[];
  fromTailwind?: number | string;
  toTailwind?: number | string;
  /** Only apply safety: "safe" migrations. Default true. */
  safeOnly?: boolean;
  /** When false, skip all migrations. */
  enabled?: boolean;
}

/**
 * Apply a single utility migration, preserving variants and important.
 */
export function migrateUtility(
  token: string,
  options: ApplyMigrationOptions = {},
): { token: string; transformation: TransformationRecord | null } {
  if (options.enabled === false) {
    return { token, transformation: null };
  }

  const list = filterMigrations(options.migrations ?? TAILWIND_MIGRATIONS, {
    fromTailwind: options.fromTailwind,
    toTailwind: options.toTailwind,
    safeOnly: options.safeOnly ?? true,
  });
  const index = buildMigrationIndex(list);

  const parts = parseUtility(token);
  // Reconstruct base without variants/important for lookup
  const baseKey = parts.base.startsWith("-") ? parts.base.slice(1) : parts.base;
  const migration = index.get(baseKey);
  if (!migration) {
    return { token, transformation: null };
  }

  // Apply replacement base while preserving negative / variants / important
  const negative = parts.base.startsWith("-");
  const newBase = negative ? `-${migration.canonicalClass}` : migration.canonicalClass;
  // Rebuild with variants + important
  let next = `${parts.variants}${newBase}`;
  if (parts.important) {
    next = `${next}!`;
  }

  if (next === token) {
    return { token, transformation: null };
  }

  return {
    token: next,
    transformation: {
      category: "tailwind-migration",
      original: token,
      replacement: next,
      confidence: "exact",
      safety: migration.safety === "safe" ? "safe" : "review",
      id: migration.id,
      notes: migration.notes,
    },
  };
}

/**
 * Convenience: migrate using formatUtility when base is namespace-value shaped.
 * Prefer migrateUtility which preserves multi-segment bases.
 */
export function migrateUtilityParts(
  token: string,
  deprecatedBase: string,
  canonicalBase: string,
): string {
  const parts = parseUtility(token);
  if (parts.base !== deprecatedBase && parts.base !== `-${deprecatedBase}`) {
    return token;
  }
  const negative = parts.base.startsWith("-");
  // For simple namespace-value we could use formatUtility; multi-segment uses full base
  const base = negative ? `-${canonicalBase}` : canonicalBase;
  let out = `${parts.variants}${base}`;
  if (parts.important) {
    out += "!";
  }
  return out;
}

// silence unused if tree-shaken
void formatUtility;
