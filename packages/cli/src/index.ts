export { HELP, parseArgs, type CliArgs, type CliCommand } from "./args.js";
export { run } from "./run.js";

export {
  canonicalizeClass,
  canonicalizeClasses,
  canonicalizeFile,
  canonicalizeProject,
  canonicalizeSource,
  createDefaultTheme,
  createTailwindCompileEqual,
  defineConfig,
  DEFAULT_COLOR_PALETTE,
  extractClassOccurrences,
  findCanonicalEquivalent,
  loadConfig,
  loadProjectTheme,
  loadThemeFromCss,
  loadThemeFromProject,
  loadThemeFromV3Config,
  TAILWIND_MIGRATIONS,
  watchProject,
} from "@tailwind-canonicalize/compiler";
