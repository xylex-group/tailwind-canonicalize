export {
  canonicalizeClass,
  canonicalizeClasses,
  canonicalizeFile,
  canonicalizeProject,
  canonicalizeSource,
  findCanonicalEquivalent,
  transformClassString,
} from "./canonicalize.js";
export {
  configToPipelineFlags,
  defineConfig,
  loadConfig,
  type TailwindCanonicalizeConfig,
} from "./config.js";
export {
  cachePath,
  emptyCache,
  hashContent,
  hashOptions,
  loadCache,
  saveCache,
  type IncrementalCache,
} from "./hash-cache.js";
export { collectFiles } from "./scan.js";
export type {
  CanonicalizeFileOptions,
  ClassStringDiagnostic,
  FileResult,
  ProjectOptions,
  ProjectSummary,
  Rewrite,
  Theme,
  TransformationRecord,
  TransformResult,
} from "./types.js";
export { watchProject, type WatchOptions } from "./watch.js";
export { runWithWorkerPool, serializeTheme, reviveTheme } from "./worker-pool.js";

export {
  createDefaultTheme,
  createTailwindCompileEqual,
  loadProjectTheme,
  loadThemeFromCss,
  loadThemeFromProject,
  loadThemeFromV3Config,
  parseUtility,
  TAILWIND_MIGRATIONS,
  migrateUtility,
  utilityIdentity,
  DEFAULT_COLOR_PALETTE,
} from "@tailwind-canonicalize/resolver";
export {
  extractClassOccurrences,
  tokenizeClasses,
} from "@tailwind-canonicalize/parser";
