import { cpus } from "node:os";
import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { FileResult } from "./types.js";

export interface WorkerTask {
  filePath: string;
  write: boolean;
  /** JSON-serializable pipeline options (theme as plain object) */
  optionsJson: string;
}

export interface SerializedTheme {
  spacingUnit: { value: number; unit: string; raw: string } | null;
  spacing: Array<[string, string]>;
  colors: Array<[string, string]>;
  borderRadius: Array<[string, string]>;
  fontSize: Array<[string, string]>;
  lineHeight: Array<[string, string]>;
  letterSpacing: Array<[string, string]>;
  blur: Array<[string, string]>;
  boxShadow: Array<[string, string]>;
  opacity: Array<[string, string]>;
  cssVariables: Array<[string, string]>;
  source: string;
  tailwindVersion?: 3 | 4;
}

/**
 * Run file transforms in worker_threads for large monorepos.
 * Falls back to sequential main-thread processing on worker failure.
 */
export async function runWithWorkerPool(
  tasks: WorkerTask[],
  concurrency: number,
  onFile?: (result: FileResult) => void,
): Promise<FileResult[]> {
  if (tasks.length === 0) {
    return [];
  }

  const workers = Math.max(
    1,
    Math.min(concurrency, tasks.length, Math.max(1, cpus().length - 1)),
  );

  // Resolve worker file next to this module (dist/worker.js after build)
  const workerUrl = new URL("./worker.js", import.meta.url);
  let workerPath: string;
  try {
    workerPath = fileURLToPath(workerUrl);
  } catch {
    workerPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "worker.js");
  }

  const results: FileResult[] = [];
  let cursor = 0;

  async function spawnWorker(): Promise<void> {
    while (cursor < tasks.length) {
      const task = tasks[cursor]!;
      cursor += 1;
      try {
        const result = await runOneTask(workerPath, task);
        results.push(result);
        onFile?.(result);
      } catch {
        // Fallback: process on main thread via dynamic import
        const { canonicalizeFile } = await import("./canonicalize.js");
        const opts = JSON.parse(task.optionsJson) as Record<string, unknown>;
        const result = await canonicalizeFile(task.filePath, {
          ...deserializeOptions(opts),
          write: task.write,
          dryRun: !task.write,
        });
        results.push(result);
        onFile?.(result);
      }
    }
  }

  await Promise.all(Array.from({ length: workers }, () => spawnWorker()));
  return results;
}

function runOneTask(workerPath: string, task: WorkerTask): Promise<FileResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, {
      workerData: task,
    });
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(new Error(`Worker timeout: ${task.filePath}`));
    }, 60_000);

    worker.on("message", (msg: { ok: boolean; result?: FileResult; error?: string }) => {
      clearTimeout(timer);
      void worker.terminate();
      if (msg.ok && msg.result) {
        resolve(msg.result);
      } else {
        reject(new Error(msg.error ?? "worker failed"));
      }
    });
    worker.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    worker.on("exit", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Worker exited ${code}`));
      }
    });
  });
}

function deserializeOptions(opts: Record<string, unknown>): Record<string, unknown> {
  // Theme maps are restored in worker; main-thread fallback uses plain objects
  if (opts.theme && typeof opts.theme === "object") {
    opts.theme = reviveTheme(opts.theme as SerializedTheme);
  }
  return opts;
}

export function serializeTheme(theme: {
  spacingUnit: { value: number; unit: string; raw: string } | null;
  spacing: { values: Map<string, string> };
  colors: { values: Map<string, string> };
  borderRadius: { values: Map<string, string> };
  fontSize: { values: Map<string, string> };
  lineHeight: { values: Map<string, string> };
  letterSpacing: { values: Map<string, string> };
  blur: { values: Map<string, string> };
  boxShadow: { values: Map<string, string> };
  opacity: { values: Map<string, string> };
  width: { values: Map<string, string> };
  height: { values: Map<string, string> };
  cssVariables: Map<string, string>;
  source: string;
  tailwindVersion?: 3 | 4;
}): SerializedTheme {
  return {
    spacingUnit: theme.spacingUnit,
    spacing: [...theme.spacing.values],
    colors: [...theme.colors.values],
    borderRadius: [...theme.borderRadius.values],
    fontSize: [...theme.fontSize.values],
    lineHeight: [...theme.lineHeight.values],
    letterSpacing: [...theme.letterSpacing.values],
    blur: [...theme.blur.values],
    boxShadow: [...theme.boxShadow.values],
    opacity: [...theme.opacity.values],
    cssVariables: [...theme.cssVariables],
    source: theme.source,
    tailwindVersion: theme.tailwindVersion,
  };
}

export function reviveTheme(s: SerializedTheme): {
  spacingUnit: SerializedTheme["spacingUnit"];
  spacing: { values: Map<string, string> };
  colors: { values: Map<string, string> };
  borderRadius: { values: Map<string, string> };
  fontSize: { values: Map<string, string> };
  lineHeight: { values: Map<string, string> };
  letterSpacing: { values: Map<string, string> };
  blur: { values: Map<string, string> };
  boxShadow: { values: Map<string, string> };
  opacity: { values: Map<string, string> };
  width: { values: Map<string, string> };
  height: { values: Map<string, string> };
  cssVariables: Map<string, string>;
  source: string;
  tailwindVersion?: 3 | 4;
} {
  const spacing = { values: new Map(s.spacing) };
  return {
    spacingUnit: s.spacingUnit,
    spacing,
    colors: { values: new Map(s.colors) },
    borderRadius: { values: new Map(s.borderRadius) },
    fontSize: { values: new Map(s.fontSize) },
    lineHeight: { values: new Map(s.lineHeight) },
    letterSpacing: { values: new Map(s.letterSpacing) },
    blur: { values: new Map(s.blur) },
    boxShadow: { values: new Map(s.boxShadow) },
    opacity: { values: new Map(s.opacity) },
    width: { values: new Map(s.spacing) },
    height: { values: new Map(s.spacing) },
    cssVariables: new Map(s.cssVariables),
    source: s.source,
    tailwindVersion: s.tailwindVersion ?? 4,
  };
}
