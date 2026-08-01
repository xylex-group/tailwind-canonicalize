/**
 * Versioned Tailwind class migration registry.
 *
 * Single auditable source — do not scatter mappings elsewhere.
 * Each entry: source/target version, rationale, safety, optional removal date.
 */

export type MigrationSafety = "safe" | "review";

export interface TailwindMigration {
  id: string;
  fromVersion: string;
  toVersion: string;
  /** Exact base class (no variants / important). */
  deprecatedClass: string;
  /** Replacement base class. */
  canonicalClass: string;
  safety: MigrationSafety;
  notes?: string;
  /** ISO date after which the entry may be removed from the registry. */
  removalDate?: string;
}

/**
 * Built-in migrations (Tailwind v3 → v4 and related renames).
 * Ordered for deterministic application (first match wins on exact base).
 */
export const TAILWIND_MIGRATIONS: readonly TailwindMigration[] = [
  // Gradient direction utilities → linear gradient direction (v4)
  ...(["t", "tr", "r", "br", "b", "bl", "l", "tl"] as const).flatMap((dir) => [
    {
      id: `gradient-direction-to-linear-direction-${dir}`,
      fromVersion: "<4",
      toVersion: ">=4",
      deprecatedClass: `bg-gradient-to-${dir}`,
      canonicalClass: `bg-linear-to-${dir}`,
      safety: "safe" as const,
      notes: "Tailwind v4 renames bg-gradient-to-* to bg-linear-to-*",
    },
    {
      id: `gradient-direction-to-linear-direction-from-${dir}`,
      fromVersion: "<4",
      toVersion: ">=4",
      deprecatedClass: `from-gradient-to-${dir}`,
      canonicalClass: `from-linear-to-${dir}`,
      safety: "review" as const,
      notes: "Rare; verify project usage before applying",
    },
  ]),
  {
    id: "shadow-sm-to-shadow-xs",
    fromVersion: "<4",
    toVersion: ">=4",
    deprecatedClass: "shadow",
    canonicalClass: "shadow-sm",
    safety: "review",
    notes:
      "v4 restyles default shadow; not auto-applied in safe mode (identity collision risk)",
  },
  {
    id: "flex-shrink-0-to-shrink-0",
    fromVersion: "<4",
    toVersion: ">=4",
    deprecatedClass: "flex-shrink-0",
    canonicalClass: "shrink-0",
    safety: "safe",
    notes: "v4 prefers shrink-0 over flex-shrink-0",
  },
  {
    id: "flex-shrink-to-shrink",
    fromVersion: "<4",
    toVersion: ">=4",
    deprecatedClass: "flex-shrink",
    canonicalClass: "shrink",
    safety: "safe",
  },
  {
    id: "flex-grow-0-to-grow-0",
    fromVersion: "<4",
    toVersion: ">=4",
    deprecatedClass: "flex-grow-0",
    canonicalClass: "grow-0",
    safety: "safe",
  },
  {
    id: "flex-grow-to-grow",
    fromVersion: "<4",
    toVersion: ">=4",
    deprecatedClass: "flex-grow",
    canonicalClass: "grow",
    safety: "safe",
  },
  {
    id: "overflow-ellipsis-to-text-ellipsis",
    fromVersion: "<4",
    toVersion: ">=4",
    deprecatedClass: "overflow-ellipsis",
    canonicalClass: "text-ellipsis",
    safety: "safe",
  },
  {
    id: "decoration-slice-to-box-decoration-slice",
    fromVersion: "<4",
    toVersion: ">=4",
    deprecatedClass: "decoration-slice",
    canonicalClass: "box-decoration-slice",
    safety: "safe",
  },
  {
    id: "decoration-clone-to-box-decoration-clone",
    fromVersion: "<4",
    toVersion: ">=4",
    deprecatedClass: "decoration-clone",
    canonicalClass: "box-decoration-clone",
    safety: "safe",
  },
  {
    id: "break-words-to-wrap-break-word",
    fromVersion: "<4",
    toVersion: ">=4",
    deprecatedClass: "break-words",
    canonicalClass: "wrap-break-word",
    safety: "safe",
    notes: "Tailwind v4 renames break-words to wrap-break-word",
  },
] as const;

/** Exact base → migration (safe entries preferred when duplicates). */
export function buildMigrationIndex(
  migrations: readonly TailwindMigration[] = TAILWIND_MIGRATIONS,
): Map<string, TailwindMigration> {
  const map = new Map<string, TailwindMigration>();
  for (const m of migrations) {
    const existing = map.get(m.deprecatedClass);
    if (!existing || (existing.safety === "review" && m.safety === "safe")) {
      map.set(m.deprecatedClass, m);
    }
  }
  return map;
}

export function filterMigrations(
  migrations: readonly TailwindMigration[],
  options: {
    fromTailwind?: number | string;
    toTailwind?: number | string;
    safeOnly?: boolean;
  } = {},
): TailwindMigration[] {
  return migrations.filter((m) => {
    if (options.safeOnly && m.safety !== "safe") {
      return false;
    }
    // Version filters are advisory tags; built-in entries use <4 / >=4.
    if (options.toTailwind !== undefined) {
      const to = Number(options.toTailwind);
      if (m.toVersion.startsWith(">=") && Number(m.toVersion.slice(2)) > to) {
        return false;
      }
    }
    if (options.fromTailwind !== undefined) {
      const from = Number(options.fromTailwind);
      if (m.fromVersion.startsWith("<") && from >= Number(m.fromVersion.slice(1))) {
        // fromVersion "<4" means applies when upgrading from below 4
        // always include when user opts into migrate
      }
    }
    return true;
  });
}
