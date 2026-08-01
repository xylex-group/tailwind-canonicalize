import type {
  ClassStringDiagnostic,
  PipelineMode,
  PipelineOptions,
  Theme,
  TokenMapping,
  TransformationRecord,
} from "@tailwind-canonicalize/resolver";
import type { Rewrite, TransformResult } from "@tailwind-canonicalize/transformer";

export interface CanonicalizeFileOptions extends PipelineOptions {
  filePath?: string;
  sourceMap?: boolean;
  dryRun?: boolean;
  write?: boolean;
}

export interface FileResult {
  filePath: string;
  changed: boolean;
  rewrites: Rewrite[];
  transformations: TransformationRecord[];
  diagnostics: ClassStringDiagnostic[];
  original: string;
  code: string;
  error?: string;
  /** Parser errors for this file (no rewrites applied when present). */
  parseErrors?: string[];
  /** True when skipped by incremental cache (content unchanged). */
  skipped?: boolean;
}

export interface ProjectOptions extends PipelineOptions {
  cwd?: string;
  paths?: string[];
  write?: boolean;
  check?: boolean;
  theme?: Theme;
  autoTheme?: boolean;
  /** Prefer v3 config when no CSS @theme found. Default true. */
  loadV3Config?: boolean;
  ignore?: string[];
  concurrency?: number;
  verbose?: boolean;
  mode?: PipelineMode;
  tokenMappings?: TokenMapping[];
  onFile?: (result: FileResult) => void;
  /**
   * Use worker_threads when file count exceeds threshold.
   * Default true when files >= 32.
   */
  workers?: boolean | "auto";
  /** Minimum files before workers engage. Default 32. */
  workerThreshold?: number;
  /**
   * Incremental hashing — skip unchanged files.
   * Default false for one-shot CLI; true in watch mode.
   */
  incremental?: boolean;
  /** Cache file path (relative to cwd or absolute). */
  cacheFile?: string;
  /** Persist cache after run. Default true when incremental. */
  persistCache?: boolean;
  /** Enable strict Tailwind compile comparison (requires tailwindcss). */
  strictCompile?: boolean;
  /** CSS entry for compile comparator. */
  compileCss?: string;
}

export interface ProjectSummary {
  files: number;
  filesChanged: number;
  filesSkipped: number;
  /** Applied token-level rewrites (non-empty replacement). */
  rewrites: number;
  transformations: number;
  /**
   * Applied rewrites whose safety is not `safe` (review/aggressive).
   * Always 0 in default safe mode — the engine refuses ambiguous matches.
   */
  unsafe: number;
  /** Operational file I/O / worker failures. */
  errors: number;
  /** Files (or extracts) that hit parser errors and were left untouched. */
  parseErrors: number;
  /** Conflict diagnostics (competing utilities; no automatic rewrite). */
  conflicts: number;
  elapsedMs: number;
  results: FileResult[];
  diagnostics: ClassStringDiagnostic[];
  transformationsByCategory: Record<string, number>;
  themeSource?: "css" | "v3-config" | "default" | "provided";
  /** Absolute path to CSS @theme or v3 config when auto-loaded. */
  themePath?: string | null;
}

export type {
  Rewrite,
  Theme,
  TransformResult,
  TransformationRecord,
  ClassStringDiagnostic,
};
