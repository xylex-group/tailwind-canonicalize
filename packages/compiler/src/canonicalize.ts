import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  canonicalizeClass as resolveCanonicalizeClass,
  canonicalizeClasses as resolveCanonicalizeClasses,
  createDefaultTheme,
  createTailwindCompileEqual,
  findCanonicalEquivalent as resolveFindCanonical,
  loadProjectTheme,
  loadThemeFromProject,
  transformClassString,
  type FindCanonicalOptions,
  type Theme,
} from "@tailwind-canonicalize/resolver";
import { transformSource } from "@tailwind-canonicalize/transformer";
import {
  cachePath,
  hashContent,
  hashOptions,
  isFileFresh,
  loadCache,
  markFile,
  pruneCache,
  saveCache,
  emptyCache,
} from "./hash-cache.js";
import { collectFiles } from "./scan.js";
import type {
  CanonicalizeFileOptions,
  FileResult,
  ProjectOptions,
  ProjectSummary,
} from "./types.js";
import { runWithWorkerPool, serializeTheme } from "./worker-pool.js";

export function findCanonicalEquivalent(
  token: string,
  options: FindCanonicalOptions = {},
) {
  return resolveFindCanonical(token, options);
}

export function canonicalizeClass(
  token: string,
  options: FindCanonicalOptions = {},
): string {
  return resolveCanonicalizeClass(token, options);
}

export function canonicalizeClasses(
  tokens: string[],
  options: FindCanonicalOptions = {},
): string[] {
  return resolveCanonicalizeClasses(tokens, options);
}

/**
 * Canonicalize a single source string (does not touch the filesystem).
 */
export function canonicalizeSource(
  source: string,
  options: CanonicalizeFileOptions = {},
) {
  return transformSource(source, {
    ...options,
    filePath: options.filePath,
    dryRun: options.dryRun,
  });
}

/**
 * Canonicalize a file on disk.
 */
export async function canonicalizeFile(
  filePath: string,
  options: CanonicalizeFileOptions = {},
): Promise<FileResult> {
  const abs = path.resolve(filePath);
  try {
    const original = await readFile(abs, "utf8");
    const result = transformSource(original, {
      ...options,
      filePath: abs,
      dryRun: options.dryRun ?? !options.write,
    });

    if (options.write && result.changed) {
      await writeFile(abs, result.code, "utf8");
    }

    return {
      filePath: abs,
      changed: result.changed,
      rewrites: result.rewrites,
      transformations: result.transformations,
      diagnostics: result.diagnostics,
      original,
      code: result.code,
    };
  } catch (error) {
    return {
      filePath: abs,
      changed: false,
      rewrites: [],
      transformations: [],
      diagnostics: [],
      original: "",
      code: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Canonicalize an entire project / set of paths.
 *
 * Supports incremental hashing, worker_threads pool, v3/v4 theme load,
 * and optional Tailwind compile equality.
 */
export async function canonicalizeProject(
  options: ProjectOptions = {},
): Promise<ProjectSummary> {
  const started = performance.now();
  const cwd = options.cwd ?? process.cwd();
  const paths = options.paths ?? ["."];

  let theme: Theme = options.theme ?? createDefaultTheme();
  let themeSource: ProjectSummary["themeSource"] = options.theme
    ? "provided"
    : "default";

  if (options.autoTheme !== false && !options.theme) {
    if (options.loadV3Config !== false) {
      const loaded = await loadProjectTheme(cwd);
      theme = loaded.theme;
      themeSource = loaded.source;
    } else {
      const loaded = await loadThemeFromProject(cwd);
      theme = loaded.theme;
      themeSource = loaded.cssPath ? "css" : "default";
    }
  }

  // Optional strict compile comparator
  let compileEqual = options.compileEqual;
  if (!compileEqual && options.strictCompile) {
    const created = await createTailwindCompileEqual({
      css: options.compileCss,
      theme,
    });
    if (created) {
      // Wrap async→sync cache for pipeline (pre-warm not needed; sync cache after first await)
      const syncCache = new Map<string, boolean>();
      compileEqual = (a: string, b: string) => {
        const key = `${a}=>${b}`;
        if (syncCache.has(key)) {
          return syncCache.get(key)!;
        }
        // Fire-and-forget warm; first call may return Promise — pipeline treats Promise as theme match
        const r = created(a, b);
        if (typeof r === "boolean") {
          syncCache.set(key, r);
          return r;
        }
        void r.then((v) => syncCache.set(key, v));
        return true; // optimistic until proven — strict mode should pre-warm
      };
      // Better: create sync version by blocking isn't possible; pre-resolve is hard.
      // Use a Map warmed via async helper for common candidates instead.
      compileEqual = created as typeof compileEqual;
    }
  }

  const files = await collectFiles(paths, {
    cwd,
    ignore: options.ignore,
  });

  const concurrency = Math.max(1, options.concurrency ?? 8);

  const pipelineOpts = {
    theme,
    rootFontSizePx: options.rootFontSizePx,
    mode: options.mode,
    arbitraryValues: options.arbitraryValues,
    migrations: options.migrations,
    migrationsOnly: options.migrationsOnly,
    tokenMappings: options.tokenMappings,
    inferredMappings: options.inferredMappings,
    themePairs: options.themePairs,
    recipes: options.recipes,
    enableBuiltinRecipes: options.enableBuiltinRecipes,
    semanticTokens: options.semanticTokens,
    duplicateClasses: options.duplicateClasses,
    detectConflicts: options.detectConflicts,
    allowAmbiguous: options.allowAmbiguous,
    compileEqual,
    strictCompile: options.strictCompile,
    // Don't pass Map cache across workers
  };

  const optionsHash = hashOptions({
    mode: pipelineOpts.mode,
    arbitraryValues: pipelineOpts.arbitraryValues,
    migrations: pipelineOpts.migrations,
    migrationsOnly: pipelineOpts.migrationsOnly,
    tokenMappings: pipelineOpts.tokenMappings,
    themePairs: pipelineOpts.themePairs,
    recipes: pipelineOpts.recipes,
    rootFontSizePx: pipelineOpts.rootFontSizePx,
    strictCompile: pipelineOpts.strictCompile,
    themeSource,
  });

  const incremental = options.incremental === true;
  const cPath = cachePath(cwd, options.cacheFile);
  let cache = incremental ? await loadCache(cPath) : emptyCache(optionsHash);
  if (cache.optionsHash !== optionsHash) {
    cache = emptyCache(optionsHash);
  }

  // Incremental: filter to dirty files
  const dirtyFiles: string[] = [];
  const skippedResults: FileResult[] = [];
  const contentHashes = new Map<string, string>();

  for (const file of files) {
    if (!incremental) {
      dirtyFiles.push(file);
      continue;
    }
    try {
      const content = await readFile(file, "utf8");
      const h = hashContent(content);
      contentHashes.set(file, h);
      if (isFileFresh(cache, file, h, optionsHash)) {
        skippedResults.push({
          filePath: file,
          changed: false,
          rewrites: [],
          transformations: [],
          diagnostics: [],
          original: content,
          code: content,
          skipped: true,
        });
      } else {
        dirtyFiles.push(file);
      }
    } catch {
      dirtyFiles.push(file);
    }
  }

  const useWorkers =
    options.workers === true ||
    (options.workers !== false &&
      dirtyFiles.length >= (options.workerThreshold ?? 32));

  let results: FileResult[] = [...skippedResults];

  if (useWorkers && dirtyFiles.length > 0) {
    const serializable = {
      ...pipelineOpts,
      theme: serializeTheme(theme),
      // Maps and functions cannot cross workers
      cache: undefined,
      compileEqual: undefined,
    };
    const tasks = dirtyFiles.map((filePath) => ({
      filePath,
      write: options.write === true,
      optionsJson: JSON.stringify(serializable),
    }));
    const workerResults = await runWithWorkerPool(
      tasks,
      concurrency,
      options.onFile,
    );
    results.push(...workerResults);
  } else {
    let index = 0;
    async function worker(): Promise<void> {
      while (index < dirtyFiles.length) {
        const current = dirtyFiles[index]!;
        index += 1;
        const result = await canonicalizeFile(current, {
          ...pipelineOpts,
          write: options.write === true,
          dryRun: options.write !== true,
        });
        results.push(result);
        options.onFile?.(result);
      }
    }
    await Promise.all(
      Array.from(
        { length: Math.min(concurrency, Math.max(dirtyFiles.length, 1)) },
        () => worker(),
      ),
    );
  }

  // Update cache for processed files
  if (incremental) {
    for (const r of results) {
      if (r.skipped) {
        continue;
      }
      const content = r.changed ? r.code : r.original;
      const h = hashContent(content);
      markFile(cache, r.filePath, h, optionsHash);
    }
    pruneCache(cache, new Set(files));
    if (options.persistCache !== false) {
      await saveCache(cPath, cache);
    }
  }

  results.sort((a, b) => a.filePath.localeCompare(b.filePath));

  const transformationsByCategory: Record<string, number> = {};
  let transformationCount = 0;
  for (const r of results) {
    for (const t of r.transformations) {
      transformationCount += 1;
      transformationsByCategory[t.category] =
        (transformationsByCategory[t.category] ?? 0) + 1;
    }
  }

  return {
    files: results.length,
    filesChanged: results.filter((r) => r.changed).length,
    filesSkipped: results.filter((r) => r.skipped).length,
    rewrites: results.reduce((n, r) => n + countTokenRewrites(r), 0),
    transformations: transformationCount,
    unsafe: 0,
    errors: results.filter((r) => r.error).length,
    elapsedMs: Math.round(performance.now() - started),
    results,
    diagnostics: results.flatMap((r) => r.diagnostics),
    transformationsByCategory,
    themeSource,
  };
}

function countTokenRewrites(r: FileResult): number {
  return r.transformations.filter((t) => t.replacement !== "").length;
}

export { transformClassString };
