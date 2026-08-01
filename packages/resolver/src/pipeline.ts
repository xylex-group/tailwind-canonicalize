import type {
  ClassStringDiagnostic,
  PipelineResult,
  TransformationRecord,
} from "./categories.js";
import {
  collapseDarkPairs,
  type ThemePairMapping,
} from "./dark-pairs.js";
import { dedupeClassTokens } from "./dedupe.js";
import { findCanonicalEquivalent } from "./find-canonical.js";
import { migrateUtility, type ApplyMigrationOptions } from "./migrations/apply.js";
import { parseUtility } from "./parse-utility.js";
import {
  BUILTIN_RECIPES,
  resolveRecipeOverrides,
  type SemanticColorRecipe,
} from "./recipes.js";
import type { FindCanonicalOptions } from "./types.js";

export type PipelineMode = "safe" | "review" | "aggressive";

export interface TokenMapping {
  /** Source utility base (no variants), e.g. `bg-white` or `text-slate-800`. */
  source: string;
  /** Target utility base, e.g. `bg-background`. */
  target: string;
  token?: string;
  category?: "semantic-color-token" | "semantic-spacing-token";
  /** Confidence when from analysis (aggressive mode). */
  confidence?: number;
}

export interface PipelineOptions extends FindCanonicalOptions {
  mode?: PipelineMode;
  /** Enable arbitrary → theme scale. Default true. */
  arbitraryValues?: boolean;
  /** Enable Tailwind class migrations. Default false unless --migrate. */
  migrations?: boolean | ApplyMigrationOptions;
  /**
   * Approved semantic token mappings (opt-in).
   * Never applied unless provided — semantic migration is architectural.
   */
  tokenMappings?: TokenMapping[];
  /**
   * High-confidence inferred mappings. Applied only in `--aggressive` mode.
   */
  inferredMappings?: TokenMapping[];
  /** Light/dark pair collapses (opt-in via manifest). */
  themePairs?: ThemePairMapping[];
  /** Semantic recipes for coherent multi-utility replacement. */
  recipes?: SemanticColorRecipe[];
  /** Enable semantic mappings when mappings exist. Default true. */
  semanticTokens?: boolean;
  /** Apply built-in recipes when sources co-occur and mappings cover them. Default false unless recipes provided. */
  enableBuiltinRecipes?: boolean;
  /** Remove duplicate / equivalent utilities. Default true. */
  duplicateClasses?: boolean;
  /** Detect conflicts. Default true. */
  detectConflicts?: boolean;
  /** migrations-only: skip canonical + semantic. */
  migrationsOnly?: boolean;
}

/**
 * Full multi-category class-string pipeline.
 *
 * Order (deterministic):
 * 1. Tailwind migrations (if enabled)
 * 2. Arbitrary canonicalization (if enabled)
 * 3. Recipe overrides (co-occurring surfaces)
 * 4. Approved / aggressive semantic token mappings
 * 5. Dark-pair collapse (light + dark: → single semantic)
 * 6. Duplicate / equivalent collapse
 * 7. Conflict diagnostics
 *
 * Semantic replacements are opt-in via tokenMappings / themePairs / recipes.
 * Aggressive inferred mappings never run in safe mode.
 */
export function transformClassString(
  classString: string,
  options: PipelineOptions = {},
): PipelineResult {
  const mode = options.mode ?? "safe";
  const transformations: TransformationRecord[] = [];
  const diagnostics: ClassStringDiagnostic[] = [];

  const originalParts = classString.split(/(\s+)/);
  let tokens = originalParts.filter((p) => p !== "" && !/^\s+$/.test(p));

  const migrateOpts = resolveMigrateOptions(options, mode);

  const runCanonical =
    !options.migrationsOnly && options.arbitraryValues !== false;

  // Semantic is opt-in: only when mappings/pairs provided
  const approved = options.tokenMappings ?? [];
  const inferred =
    mode === "aggressive" ? (options.inferredMappings ?? []) : [];
  const effectiveMappings = mergeMappings(approved, inferred, mode);

  const runSemantic =
    !options.migrationsOnly &&
    options.semanticTokens !== false &&
    effectiveMappings.length > 0 &&
    mode !== "review";

  const recipes =
    options.recipes ??
    (options.enableBuiltinRecipes ? BUILTIN_RECIPES : []);

  // Recipe overrides (only when semantic is active or recipes explicitly set)
  let recipeOverrides = new Map<string, string>();
  if (
    !options.migrationsOnly &&
    mode !== "review" &&
    recipes.length > 0 &&
    (runSemantic || options.recipes)
  ) {
    const resolved = resolveRecipeOverrides(tokens, recipes);
    recipeOverrides = resolved.overrides;
    // Don't push recipe note as a write unless something actually maps later
  }

  const tokenOut: string[] = [];

  for (const token of tokens) {
    let current = token;

    if (migrateOpts.enabled !== false) {
      const m = migrateUtility(current, migrateOpts);
      if (m.transformation) {
        transformations.push(m.transformation);
        current = m.token;
      }
    }

    if (options.migrationsOnly) {
      tokenOut.push(current);
      continue;
    }

    if (runCanonical) {
      const match = findCanonicalEquivalent(current, options);
      if (match && match.canonical !== current) {
        transformations.push({
          category: "canonical-class",
          original: current,
          replacement: match.canonical,
          confidence: "exact",
          safety: "safe",
          notes: match.reason,
        });
        current = match.canonical;
      }
    }

    if (runSemantic || recipeOverrides.size > 0) {
      const mapped = applyTokenMapping(current, effectiveMappings, recipeOverrides);
      if (mapped) {
        transformations.push(mapped.transformation);
        current = mapped.token;
      }
    }

    tokenOut.push(current);
  }

  tokens = tokenOut;

  // Dark-pair collapse after individual mappings
  if (
    !options.migrationsOnly &&
    mode !== "review" &&
    (options.themePairs?.length ?? 0) > 0
  ) {
    const collapsed = collapseDarkPairs(tokens, {
      pairs: options.themePairs,
      requireProven: true,
    });
    tokens = collapsed.tokens;
    transformations.push(...collapsed.transformations);
  }

  if (!options.migrationsOnly && options.duplicateClasses !== false) {
    const deduped = dedupeClassTokens(tokens, {
      ...options,
      removeDuplicates: true,
      detectConflicts: options.detectConflicts !== false,
      collapseEquivalent: mode !== "review",
    });
    tokens = deduped.tokens;
    transformations.push(...deduped.transformations);
    diagnostics.push(...deduped.diagnostics);
  }

  const result = rebuildPreservingWhitespace(originalParts, tokens);
  return { result, transformations, diagnostics };
}

function mergeMappings(
  approved: TokenMapping[],
  inferred: TokenMapping[],
  mode: PipelineMode,
): TokenMapping[] {
  const map = new Map<string, TokenMapping>();
  for (const m of approved) {
    map.set(m.source, m);
  }
  if (mode === "aggressive") {
    for (const m of inferred) {
      // Only high-confidence inferred; never override approved
      if ((m.confidence ?? 0) >= 0.8 && !map.has(m.source)) {
        map.set(m.source, m);
      }
    }
  }
  return [...map.values()];
}

function resolveMigrateOptions(
  options: PipelineOptions,
  mode: PipelineMode,
): ApplyMigrationOptions {
  if (options.migrations === false) {
    return { enabled: false };
  }
  if (options.migrationsOnly) {
    return {
      enabled: true,
      safeOnly: mode !== "aggressive",
      ...(typeof options.migrations === "object" ? options.migrations : {}),
    };
  }
  if (options.migrations === true) {
    return { enabled: true, safeOnly: mode !== "aggressive" };
  }
  if (typeof options.migrations === "object") {
    return {
      safeOnly: mode !== "aggressive",
      ...options.migrations,
      enabled: options.migrations.enabled !== false,
    };
  }
  return { enabled: false };
}

function applyTokenMapping(
  token: string,
  mappings: TokenMapping[],
  recipeOverrides: Map<string, string>,
): { token: string; transformation: TransformationRecord } | null {
  const parts = parseUtility(token);
  const base = parts.base.startsWith("-") ? parts.base.slice(1) : parts.base;

  // Recipe override takes precedence for coherent surfaces
  let target = recipeOverrides.get(base);
  let mapping = mappings.find((m) => m.source === base);
  let tokenVar = mapping?.token;
  let category = mapping?.category ?? "semantic-color-token";
  let confidence: TransformationRecord["confidence"] = "exact";
  let notes = "Approved token mapping";

  if (target) {
    notes = "Recipe-coherent semantic mapping";
    confidence = "high";
    // Still prefer approved mapping token meta if present
    if (mapping && mapping.target === target) {
      tokenVar = mapping.token;
    } else {
      // Find mapping for this target
      const byTarget = mappings.find((m) => m.target === target);
      tokenVar = byTarget?.token ?? tokenVar;
    }
  } else if (mapping) {
    target = mapping.target;
    if (mapping.confidence !== undefined && mapping.confidence < 1) {
      confidence = mapping.confidence >= 0.8 ? "high" : "medium";
      notes = "Inferred mapping (aggressive mode)";
    }
  } else {
    return null;
  }

  const negative = parts.base.startsWith("-");
  let next = `${parts.variants}${negative ? "-" : ""}${target}`;
  if (parts.important) {
    next += "!";
  }
  if (next === token) {
    return null;
  }

  return {
    token: next,
    transformation: {
      category,
      original: token,
      replacement: next,
      token: tokenVar,
      confidence,
      safety: confidence === "exact" ? "safe" : "aggressive",
      notes,
    },
  };
}

function rebuildPreservingWhitespace(originalParts: string[], newTokens: string[]): string {
  const out: string[] = [];
  let ti = 0;
  for (const part of originalParts) {
    if (part === "") {
      continue;
    }
    if (/^\s+$/.test(part)) {
      if (ti >= newTokens.length) {
        if (out.length === 0) {
          out.push(part);
        } else if (ti === newTokens.length && part.includes("\n")) {
          out.push(part);
        }
        continue;
      }
      out.push(part);
    } else if (ti < newTokens.length) {
      out.push(newTokens[ti]!);
      ti++;
    }
  }
  while (ti < newTokens.length) {
    if (out.length > 0 && !/^\s+$/.test(out[out.length - 1] ?? " ")) {
      out.push(" ");
    }
    out.push(newTokens[ti]!);
    ti++;
  }
  return out.join("");
}

/**
 * Back-compat wrapper used by older call sites.
 */
export function canonicalizeClassString(
  classString: string,
  options: PipelineOptions = {},
): {
  result: string;
  rewrites: Array<{ from: string; to: string }>;
  transformations: TransformationRecord[];
  diagnostics: ClassStringDiagnostic[];
} {
  const pipeline = transformClassString(classString, {
    ...options,
    migrations: options.migrations ?? false,
  });
  const rewrites = pipeline.transformations
    .filter((t) => t.replacement !== "")
    .map((t) => ({ from: t.original, to: t.replacement }));
  return {
    result: pipeline.result,
    rewrites,
    transformations: pipeline.transformations,
    diagnostics: pipeline.diagnostics,
  };
}
