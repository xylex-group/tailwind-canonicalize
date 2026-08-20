export type {
  ClassStringDiagnostic,
  Confidence,
  PipelineResult,
  SafetyLevel,
  TransformationCategory,
  TransformationRecord,
  UtilityIdentity,
} from "./categories.js";
export {
  type CompileEqualFn,
  createTailwindCompileEqual,
  normalizeCompiledCss,
  unavailableCompileEqual,
} from "./compile-equal.js";
export {
  collapseDarkPairs,
  proveThemePair,
  type ThemePairMapping,
} from "./dark-pairs.js";
export { dedupeClassTokens } from "./dedupe.js";
export { createDefaultTheme } from "./default-theme.js";
export {
  canonicalizeClass,
  canonicalizeClasses,
  findCanonicalEquivalent,
} from "./find-canonical.js";
export {
  formatScaleKey,
  invertSpacingMultiplier,
  normalizeCssValue,
  parseLength,
  resolveSpacingMultiplier,
  toPx,
  valuesEqual,
} from "./length.js";
export { loadThemeFromCss, loadThemeFromProject } from "./load-theme.js";
export {
  loadProjectTheme,
  loadThemeFromV3Config,
} from "./load-v3-config.js";
export {
  type ApplyMigrationOptions,
  migrateUtility,
} from "./migrations/apply.js";
export {
  buildMigrationIndex,
  filterMigrations,
  type MigrationSafety,
  TAILWIND_MIGRATIONS,
  type TailwindMigration,
} from "./migrations/registry.js";
export {
  alternateScales,
  KEYWORD_MAP,
  normalizeEaseValue,
  scaleForNamespace,
} from "./namespace.js";
export {
  DEFAULT_COLOR_PALETTE,
  defaultColorScale,
} from "./palette-default.js";
export { arbitraryInner, formatUtility, parseUtility } from "./parse-utility.js";
export {
  canonicalizeClassString,
  type PipelineMode,
  type PipelineOptions,
  type TokenMapping,
  transformClassString,
} from "./pipeline.js";
export {
  BUILTIN_RECIPES,
  resolveRecipeOverrides,
  type SemanticColorRecipe,
} from "./recipes.js";
export type {
  CanonicalMatch,
  EquivalenceReason,
  FindCanonicalOptions,
  LengthUnit,
  ParsedLength,
  ResolveOptions,
  Theme,
  ThemeScale,
  UtilityParts,
} from "./types.js";
export {
  propertyGroupForNamespace,
  utilitiesConflict,
  utilityIdentity,
} from "./utility-identity.js";
