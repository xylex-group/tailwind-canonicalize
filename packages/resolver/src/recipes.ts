import type { TransformationRecord } from "./categories.js";
import { parseUtility } from "./parse-utility.js";

/**
 * Coherent multi-utility semantic recipe.
 * Applied only when all listed *source* keys are present in the class string
 * and mappings for those sources exist — ensures foreground/border follow background.
 */
export interface SemanticColorRecipe {
  name: string;
  utilities: {
    background?: string;
    foreground?: string;
    border?: string;
    ring?: string;
    icon?: string;
  };
  /**
   * Optional: palette bases that activate this recipe when co-occurring.
   * e.g. { background: "bg-amber-200", border: "border-amber-200", foreground: "text-slate-800" }
   */
  sources?: {
    background?: string;
    foreground?: string;
    border?: string;
    ring?: string;
    icon?: string;
  };
}

export interface RecipeApplyResult {
  /** Override map: source base → target base for this class string only */
  overrides: Map<string, string>;
  transformations: TransformationRecord[];
}

/**
 * When a class string contains a full recipe source set, force coherent targets
 * so we don't get `bg-warning-subtle` + `text-foreground` for a warning surface.
 */
export function resolveRecipeOverrides(
  tokens: string[],
  recipes: SemanticColorRecipe[],
): RecipeApplyResult {
  const bases = new Set(
    tokens.map((t) => {
      const p = parseUtility(t);
      return p.base.startsWith("-") ? p.base.slice(1) : p.base;
    }),
  );

  const overrides = new Map<string, string>();
  const transformations: TransformationRecord[] = [];

  for (const recipe of recipes) {
    const sources = recipe.sources;
    if (!sources) {
      continue;
    }
    const sourceList = Object.values(sources).filter(Boolean) as string[];
    if (sourceList.length < 2) {
      continue;
    }
    const allPresent = sourceList.every((s) => bases.has(s));
    if (!allPresent) {
      continue;
    }

    // Apply coherent targets for present sources
    if (sources.background && recipe.utilities.background) {
      overrides.set(sources.background, recipe.utilities.background);
    }
    if (sources.foreground && recipe.utilities.foreground) {
      overrides.set(sources.foreground, recipe.utilities.foreground);
    }
    if (sources.border && recipe.utilities.border) {
      overrides.set(sources.border, recipe.utilities.border);
    }
    if (sources.ring && recipe.utilities.ring) {
      overrides.set(sources.ring, recipe.utilities.ring);
    }
    if (sources.icon && recipe.utilities.icon) {
      overrides.set(sources.icon, recipe.utilities.icon);
    }

    transformations.push({
      category: "semantic-color-token",
      original: sourceList.join(" "),
      replacement: Object.values(recipe.utilities).filter(Boolean).join(" "),
      confidence: "high",
      safety: "safe",
      notes: `Recipe '${recipe.name}' co-occurrence override`,
      id: `recipe:${recipe.name}`,
    });
  }

  return { overrides, transformations };
}

/**
 * Default recipes for common surfaces (used when manifest omits recipes).
 */
export const BUILTIN_RECIPES: SemanticColorRecipe[] = [
  {
    name: "warning-surface",
    sources: {
      background: "bg-amber-200",
      border: "border-amber-200",
      foreground: "text-slate-800",
    },
    utilities: {
      background: "bg-warning-subtle",
      border: "border-warning-subtle",
      foreground: "text-warning-foreground",
    },
  },
  {
    name: "surface",
    sources: {
      background: "bg-white",
      foreground: "text-slate-800",
      border: "border-slate-200",
    },
    utilities: {
      background: "bg-background",
      foreground: "text-foreground",
      border: "border-border",
    },
  },
];
