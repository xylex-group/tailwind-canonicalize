import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  canonicalizeProject,
  canonicalizeSource,
  collectFiles,
  loadConfig,
  configToPipelineFlags,
  watchProject,
} from "@tailwind-canonicalize/compiler";
import type { TransformationRecord } from "@tailwind-canonicalize/resolver";
import {
  analyzeColorTokens,
  buildStyleUsageReport,
  formatStyleUsageReportMarkdown,
  generateDualThemeFromManifest,
  loadTokenManifest,
  manifestToMappings,
  manifestToPairs,
  manifestToRecipes,
  writeStyleUsageReport,
  writeThemeCss,
  writeTokenManifest,
} from "@tailwind-canonicalize/tokens";
import { formatHelp, parseArgs, type CliArgs } from "./args.js";
import { lineDiff } from "./diff.js";
import {
  formatTransformation,
  printError,
  printProjectReport,
} from "./report.js";

const VERSION = "0.1.18";

export async function run(argv: string[] = process.argv.slice(2)): Promise<number> {
  let args: CliArgs;
  try {
    args = parseArgs(argv);
  } catch (error) {
    printError(error instanceof Error ? error.message : String(error));
    return 2;
  }

  if (args.help) {
    console.log(formatHelp());
    return 0;
  }

  if (args.version) {
    console.log(VERSION);
    return 0;
  }

  try {
    if (args.command === "tokens-analyze") {
      return await runTokensAnalyze(args);
    }
    if (args.command === "tokens-apply") {
      return await runTokensApply(args);
    }
    if (args.command === "tokens-report") {
      return await runTokensReport(args);
    }
    if (args.stdin) {
      return await runStdin(args);
    }
    if (args.watch) {
      return await runWatch(args);
    }
    return await runPaths(args);
  } catch (error) {
    printError(error instanceof Error ? error.message : String(error));
    return 2;
  }
}

async function runTokensAnalyze(args: CliArgs): Promise<number> {
  const files = await collectFiles(args.paths, {
    cwd: args.cwd,
    ignore: args.ignore.filter(Boolean),
  });
  const result = await analyzeColorTokens({
    cwd: args.cwd,
    files,
  });

  const out =
    args.outManifest ?? path.join(args.cwd, "tailwind-tokens.proposed.json");
  await writeTokenManifest(out, result.proposedManifest);

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          colors: result.colors,
          duplicates: result.duplicates,
          cycles: result.cycles,
          proposedManifestPath: out,
          mappingCount: result.proposedManifest.mappings.length,
          filesAnalyzed: files.length,
        },
        null,
        2,
      ),
    );
  } else {
    console.error(`✓ Analyzed ${files.length} files`);
    console.error(`✓ ${result.colors.length} palette utilities`);
    console.error(`✓ ${result.proposedManifest.mappings.length} high-confidence proposals`);
    console.error(`✓ ${result.duplicates.length} duplicate-value token groups`);
    console.error(`✓ ${result.cycles.length} alias cycle(s)`);
    console.error(`Wrote proposal manifest: ${out}`);
    if (files.length === 0) {
      console.error("");
      console.error(
        "! No source files matched — palette proposals need TS/TSX/JS/HTML/Vue/… under the given paths.",
      );
      console.error(
        `  Paths: ${args.paths.join(", ") || "."}`,
      );
      console.error(
        "  Tip: Next.js App Router projects usually use app/ (not src/). Try:",
      );
      console.error(
        "    tailwind-canonicalize tokens analyze . --out tailwind-tokens.json",
      );
      console.error(
        "    tailwind-canonicalize tokens analyze app components --out tailwind-tokens.json",
      );
      console.error(
        "  Note: duplicate-value groups can still appear from CSS @theme / variables even with 0 source files.",
      );
    } else {
      console.error("Review and copy approved mappings before: tokens apply");
    }
  }

  if (result.cycles.length > 0) {
    console.error("error: alias cycles detected — fix before applying tokens");
    return 2;
  }
  return files.length === 0 ? 1 : 0;
}

async function runTokensReport(args: CliArgs): Promise<number> {
  const files = await collectFiles(args.paths, {
    cwd: args.cwd,
    ignore: args.ignore.filter(Boolean),
  });
  const report = await buildStyleUsageReport({
    cwd: args.cwd,
    files,
  });

  const outJson =
    args.outManifest ??
    args.reportPath ??
    path.join(args.cwd, "styles-report.json");
  const jsonPath = path.isAbsolute(outJson)
    ? outJson
    : path.join(args.cwd, outJson);
  await writeStyleUsageReport(jsonPath, report);

  if (args.styleReportMarkdown) {
    const mdPath = path.isAbsolute(args.styleReportMarkdown)
      ? args.styleReportMarkdown
      : path.join(args.cwd, args.styleReportMarkdown);
    await writeFile(mdPath, formatStyleUsageReportMarkdown(report), "utf8");
    if (!args.json) {
      console.error(`✓ Wrote markdown: ${mdPath}`);
    }
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.error(`✓ Analyzed ${report.filesAnalyzed} files`);
    console.error(
      `✓ ${report.summary.totalHits} color utility hits · ${report.summary.uniqueUtilities} unique`,
    );
    console.error(
      `✓ ${report.summary.uniqueTags} tags · ${report.summary.driftCount} drift signal(s)`,
    );
    console.error(`Wrote style report: ${jsonPath}`);
    if (report.summary.topUtilities.length > 0) {
      console.error("");
      console.error("Top colors:");
      for (const u of report.summary.topUtilities.slice(0, 10)) {
        console.error(`  ${String(u.count).padStart(5)}  ${u.utility}`);
      }
    }
    if (report.drift.length > 0) {
      console.error("");
      console.error("Drift (sample):");
      for (const d of report.drift.slice(0, 5)) {
        console.error(`  ! [${d.severity}] ${d.message}`);
      }
      if (report.drift.length > 5) {
        console.error(`  … and ${report.drift.length - 5} more (see JSON)`);
      }
    }
    if (files.length === 0) {
      console.error("");
      console.error("! No source files matched under the given paths.");
      return 1;
    }
  }

  return 0;
}

async function runTokensApply(args: CliArgs): Promise<number> {
  if (!args.manifestPath) {
    printError("tokens apply requires a manifest path");
    return 2;
  }
  const manifest = await loadTokenManifest(
    path.isAbsolute(args.manifestPath)
      ? args.manifestPath
      : path.join(args.cwd, args.manifestPath),
  );
  const mappings = manifestToMappings(manifest);
  const pairs = manifestToPairs(manifest);
  const recipes = manifestToRecipes(manifest);

  if (args.mode === "review") {
    args.write = false;
  }

  // Theme CSS generation (theme-normalization) — only on --write, never duplicates
  if (args.write && args.mode !== "review" && manifest.generateTheme?.path) {
    const css = generateDualThemeFromManifest(manifest);
    const outPath = path.isAbsolute(manifest.generateTheme.path)
      ? manifest.generateTheme.path
      : path.join(args.cwd, manifest.generateTheme.path);
    const { written, skipped } = await writeThemeCss(outPath, css);
    if (!args.json) {
      if (written) {
        console.error(`✓ Wrote theme CSS: ${outPath}`);
      }
      if (skipped.length > 0) {
        console.error(`  · skipped existing tokens: ${skipped.join(", ")}`);
      }
    }
  }

  const summary = await canonicalizeProject({
    cwd: args.cwd,
    paths: args.paths,
    write: args.write && args.mode !== "review",
    mode: args.mode,
    tokenMappings: mappings,
    themePairs: pairs,
    recipes,
    semanticTokens: true,
    arbitraryValues: true,
    migrations: false,
    duplicateClasses: true,
    concurrency: args.concurrency,
    rootFontSizePx: args.rootFontSizePx,
    ignore: args.ignore.filter(Boolean),
  });

  return await printSummary(args, summary);
}

async function runStdin(args: CliArgs): Promise<number> {
  const source = await readStdin();
  const config = await loadConfig(args.cwd);
  const flags = configToPipelineFlags(config);

  const result = canonicalizeSource(source, {
    filePath: "stdin.tsx",
    rootFontSizePx: args.rootFontSizePx,
    mode: args.mode,
    arbitraryValues: flags.arbitraryValues,
    migrations: resolveMigrations(args, flags),
    migrationsOnly: args.migrationsOnly,
    duplicateClasses: flags.duplicateClasses,
  });

  if (args.json) {
    console.log(
      JSON.stringify({
        files: 1,
        rewrites: result.transformations.filter((t) => t.replacement).length,
        transformations: result.transformations,
        diagnostics: result.diagnostics,
        unsafe: 0,
        changed: result.changed,
      }),
    );
    return args.check && result.changed ? 1 : 0;
  }

  if (args.check) {
    if (result.changed) {
      if (args.diff) {
        console.log(lineDiff("stdin", result.original, result.code));
      }
      printAnnotated(result.transformations);
      return 1;
    }
    return 0;
  }

  if (args.mode === "review") {
    printAnnotated(result.transformations);
    return result.changed ? 1 : 0;
  }

  process.stdout.write(result.code);
  return 0;
}

async function runPaths(args: CliArgs): Promise<number> {
  const config = await loadConfig(args.cwd);
  const flags = configToPipelineFlags(config);

  let tokenMappings = undefined as ReturnType<typeof manifestToMappings> | undefined;
  let themePairs = undefined as ReturnType<typeof manifestToPairs> | undefined;
  let recipes = undefined as ReturnType<typeof manifestToRecipes> | undefined;
  let inferredMappings = undefined as ReturnType<typeof manifestToMappings> | undefined;

  if (flags.tokensEnabled && flags.manifestPath) {
    try {
      const manifest = await loadTokenManifest(
        path.isAbsolute(flags.manifestPath)
          ? flags.manifestPath
          : path.join(args.cwd, flags.manifestPath),
      );
      // Approved-only by default; aggressive may use confidence-tagged mappings as inferred
      if (args.mode === "aggressive") {
        inferredMappings = manifestToMappings(manifest).filter(
          (m) => (m.confidence ?? 1) >= 0.8,
        );
        tokenMappings = manifestToMappings(manifest).filter(
          (m) => m.confidence === undefined || m.confidence >= 1,
        );
      } else {
        tokenMappings = manifestToMappings(manifest);
      }
      themePairs = manifestToPairs(manifest);
      recipes = manifestToRecipes(manifest);
    } catch {
      // optional — semantic remains opt-in
    }
  }

  const summary = await canonicalizeProject({
    ...projectOpts(args, flags, {
      tokenMappings,
      inferredMappings,
      themePairs,
      recipes,
    }),
  });

  return await printSummary(args, summary);
}

async function runWatch(args: CliArgs): Promise<number> {
  const config = await loadConfig(args.cwd);
  const flags = configToPipelineFlags(config);
  console.error("Watching for changes… (Ctrl+C to stop)");

  const handle = await watchProject({
    ...projectOpts(args, flags, {}),
    debounceMs: 150,
    onRun: (summary) => {
      printProjectReport(
        {
          ...summary,
          results: summary.results.map((file) => ({
            ...file,
            filePath: path.relative(args.cwd, file.filePath) || file.filePath,
          })),
        },
        {
          cwd: args.cwd,
          verbose: false,
          sampleTransformations: 0,
        },
      );
    },
    onError: (err) => {
      printError(err.message);
    },
  });

  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => {
      handle.close();
      resolve();
    });
    process.on("SIGTERM", () => {
      handle.close();
      resolve();
    });
  });
  return 0;
}

function projectOpts(
  args: CliArgs,
  flags: ReturnType<typeof configToPipelineFlags>,
  tokens: {
    tokenMappings?: ReturnType<typeof manifestToMappings>;
    inferredMappings?: ReturnType<typeof manifestToMappings>;
    themePairs?: ReturnType<typeof manifestToPairs>;
    recipes?: ReturnType<typeof manifestToRecipes>;
  },
) {
  return {
    cwd: args.cwd,
    paths: args.paths,
    write: args.write && args.mode !== "review",
    check: args.check,
    concurrency: args.concurrency,
    rootFontSizePx: args.rootFontSizePx,
    ignore: args.ignore.filter(Boolean),
    verbose: args.verbose,
    mode: args.mode,
    arbitraryValues: args.migrationsOnly ? false : flags.arbitraryValues,
    migrations: resolveMigrations(args, flags),
    migrationsOnly: args.migrationsOnly,
    tokenMappings: tokens.tokenMappings,
    inferredMappings: tokens.inferredMappings,
    themePairs: tokens.themePairs,
    recipes: tokens.recipes,
    semanticTokens: Boolean(
      (tokens.tokenMappings?.length ?? 0) > 0 ||
        (tokens.inferredMappings?.length ?? 0) > 0 ||
        (tokens.themePairs?.length ?? 0) > 0,
    ),
    duplicateClasses: flags.duplicateClasses,
    incremental: args.incremental,
    workers: args.workers,
    strictCompile: args.strictCompile,
    compileCss: args.compileCss,
    cacheFile: args.cacheFile,
  };
}

function resolveMigrations(
  args: CliArgs,
  flags: ReturnType<typeof configToPipelineFlags>,
) {
  if (!args.migrate && !flags.migrations) {
    return false as const;
  }
  return {
    enabled: true,
    fromTailwind: args.fromTailwind ?? flags.fromTailwind,
    toTailwind: args.toTailwind ?? flags.toTailwind,
    safeOnly: args.mode !== "aggressive",
  };
}

async function printSummary(
  args: CliArgs,
  summary: Awaited<ReturnType<typeof canonicalizeProject>>,
): Promise<number> {
  if (args.json) {
    const payload = {
      files: summary.files,
      filesChanged: summary.filesChanged,
      filesSkipped: summary.filesSkipped,
      rewrites: summary.rewrites,
      transformations: summary.transformations,
      transformationsByCategory: summary.transformationsByCategory,
      themeSource: summary.themeSource,
      diagnostics: summary.diagnostics,
      unsafe: summary.unsafe,
      conflicts: summary.conflicts,
      parseErrors: summary.parseErrors,
      errors: summary.errors,
      elapsedMs: summary.elapsedMs,
      records: args.verbose
        ? summary.results.flatMap((r) => r.transformations)
        : undefined,
    };
    console.log(JSON.stringify(payload, null, args.verbose ? 2 : 0));
    if (args.reportPath) {
      const outPath = path.isAbsolute(args.reportPath)
        ? args.reportPath
        : path.join(args.cwd, args.reportPath);
      await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
      console.error(`✓ Wrote report: ${outPath}`);
    }
    if (summary.errors > 0) {
      return 2;
    }
    if ((args.check || args.mode === "review") && summary.filesChanged > 0) {
      return 1;
    }
    return 0;
  }

  if (args.diff) {
    for (const file of summary.results) {
      if (!file.changed) {
        continue;
      }
      const rel = path.relative(args.cwd, file.filePath);
      console.log(lineDiff(rel, file.original, file.code));
    }
  }

  // Relativize paths on file results for the report
  const relativized: typeof summary = {
    ...summary,
    results: summary.results.map((file) => ({
      ...file,
      filePath: path.relative(args.cwd, file.filePath) || file.filePath,
      transformations: file.transformations.map((t) => ({
        ...t,
        file: t.file
          ? path.relative(args.cwd, t.file) || t.file
          : path.relative(args.cwd, file.filePath) || file.filePath,
      })),
    })),
  };

  const reportOpts = {
    cwd: args.cwd,
    verbose: args.verbose,
    path: summary.themePath
      ? path.relative(args.cwd, summary.themePath) || summary.themePath
      : null,
    // In review/check without --verbose, still show a small sample of rewrites
    sampleTransformations:
      args.verbose
        ? Number.POSITIVE_INFINITY
        : args.mode === "review" || args.check
          ? 8
          : 0,
  };

  printProjectReport(relativized, { ...reportOpts, version: VERSION });

  if (args.reportPath) {
    const outPath = path.isAbsolute(args.reportPath)
      ? args.reportPath
      : path.join(args.cwd, args.reportPath);
    const chunks: string[] = [];
    const sink = {
      write(chunk: string) {
        chunks.push(chunk);
        return true;
      },
      isTTY: false,
    } as unknown as NodeJS.WriteStream;
    printProjectReport(relativized, {
      ...reportOpts,
      version: VERSION,
      stream: sink,
      color: false,
    });
    await writeFile(outPath, chunks.join(""), "utf8");
    console.error(`✓ Wrote report: ${outPath}`);
  }

  if (summary.errors > 0) {
    return 2;
  }
  if ((args.check || args.mode === "review") && summary.filesChanged > 0) {
    return 1;
  }
  return 0;
}

function printAnnotated(transformations: TransformationRecord[]): void {
  for (const t of transformations) {
    console.error(formatTransformation(t));
  }
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    process.stdin.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    process.stdin.on("error", reject);
    if (process.stdin.isTTY) {
      resolve("");
    }
  });
}


