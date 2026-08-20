export {
  canonicalizeClass,
  canonicalizeClasses,
  canonicalizeFile,
  canonicalizeProject,
  canonicalizeSource,
  createDefaultTheme,
  createTailwindCompileEqual,
  DEFAULT_COLOR_PALETTE,
  defineConfig,
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
export { makePaint, type PaintKit, useColor } from "./ansi.js";
export {
  type CliArgs,
  type CliCommand,
  formatHelp,
  HELP,
  parseArgs,
} from "./args.js";
export { run } from "./run.js";
