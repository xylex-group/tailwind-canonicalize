import { readFile, writeFile } from "node:fs/promises";
import { parentPort, workerData } from "node:worker_threads";
import { transformSource } from "@tailwind-canonicalize/transformer";
import { reviveTheme, type SerializedTheme } from "./worker-pool.js";

interface Task {
  filePath: string;
  write: boolean;
  optionsJson: string;
}

async function main(): Promise<void> {
  const task = workerData as Task;
  try {
    const opts = JSON.parse(task.optionsJson) as Record<string, unknown>;
    if (opts.theme && typeof opts.theme === "object") {
      opts.theme = reviveTheme(opts.theme as SerializedTheme);
    }

    const original = await readFile(task.filePath, "utf8");
    const result = transformSource(original, {
      ...opts,
      filePath: task.filePath,
      dryRun: !task.write,
    });

    if (task.write && result.changed) {
      await writeFile(task.filePath, result.code, "utf8");
    }

    parentPort?.postMessage({
      ok: true,
      result: {
        filePath: task.filePath,
        changed: result.changed,
        rewrites: result.rewrites,
        transformations: result.transformations,
        diagnostics: result.diagnostics,
        original,
        code: result.code,
        parseErrors: result.parseErrors,
      },
    });
  } catch (error) {
    parentPort?.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

void main();
