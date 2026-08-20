import { watch } from "node:fs";
import path from "node:path";
import type { ProjectOptions, ProjectSummary } from "./types.js";

export interface WatchOptions extends ProjectOptions {
  /** Debounce ms. Default 150. */
  debounceMs?: number;
  /** Called after each successful run. */
  onRun?: (summary: ProjectSummary) => void;
  /** Called on errors. */
  onError?: (error: Error) => void;
}

/**
 * Watch paths and re-run canonicalizeProject on changes (incremental via cache).
 * Returns a dispose function.
 */
export async function watchProject(options: WatchOptions): Promise<{ close: () => void }> {
  const { canonicalizeProject } = await import("./canonicalize.js");
  const debounceMs = options.debounceMs ?? 150;
  const paths = options.paths ?? ["."];
  const cwd = options.cwd ?? process.cwd();

  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let pending = false;

  const run = async () => {
    if (running) {
      pending = true;
      return;
    }
    running = true;
    try {
      const summary = await canonicalizeProject({
        ...options,
        // Always use incremental cache in watch mode
        incremental: true,
      });
      options.onRun?.(summary);
    } catch (error) {
      options.onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      running = false;
      if (pending) {
        pending = false;
        void run();
      }
    }
  };

  // Initial run
  void run();

  const watchers = paths.map((p) => {
    const abs = path.isAbsolute(p) ? p : path.resolve(cwd, p);
    return watch(abs, { recursive: true }, (_event, filename) => {
      if (!filename) {
        return;
      }
      const name = filename.toString();
      if (
        name.includes("node_modules") ||
        name.includes(".git") ||
        name.endsWith(".tailwind-canonicalize-cache.json")
      ) {
        return;
      }
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        void run();
      }, debounceMs);
    });
  });

  return {
    close: () => {
      if (timer) {
        clearTimeout(timer);
      }
      for (const w of watchers) {
        w.close();
      }
    },
  };
}
