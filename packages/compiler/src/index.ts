export {
  extractClassOccurrences,
  tokenizeClasses,
} from "@tailwind-canonicalize/parser";
export {
  createDefaultTheme,
  createTailwindCompileEqual,
  DEFAULT_COLOR_PALETTE,
  loadProjectTheme,
  loadThemeFromCss,
  loadThemeFromProject,
  loadThemeFromV3Config,
  migrateUtility,
  parseUtility,
  TAILWIND_MIGRATIONS,
  utilityIdentity,
} from "@tailwind-canonicalize/resolver";
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
  type IncrementalCache,
  loadCache,
  saveCache,
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
export { type WatchOptions, watchProject } from "./watch.js";
export { reviveTheme, runWithWorkerPool, serializeTheme } from "./worker-pool.js";
