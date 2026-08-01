import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { isSupportedExtension, extensionOf } from "@tailwind-canonicalize/parser";

const DEFAULT_IGNORE = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".git",
  ".next",
  ".turbo",
  ".vercel",
  ".output",
  "out",
  "vendor",
  ".pnpm-store",
]);

export async function collectFiles(
  paths: string[],
  options: { cwd?: string; ignore?: string[] } = {},
): Promise<string[]> {
  const cwd = options.cwd ?? process.cwd();
  const ignore = new Set([...DEFAULT_IGNORE, ...(options.ignore ?? [])]);
  const results: string[] = [];

  for (const input of paths) {
    const abs = path.isAbsolute(input) ? input : path.resolve(cwd, input);
    await walk(abs, ignore, results);
  }

  return [...new Set(results)].sort();
}

async function walk(
  target: string,
  ignore: Set<string>,
  out: string[],
): Promise<void> {
  let info;
  try {
    info = await stat(target);
  } catch {
    return;
  }

  if (info.isFile()) {
    if (isSupportedExtension(extensionOf(target))) {
      out.push(target);
    }
    return;
  }

  if (!info.isDirectory()) {
    return;
  }

  const base = path.basename(target);
  if (ignore.has(base)) {
    return;
  }

  let entries;
  try {
    entries = await readdir(target, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (ignore.has(entry.name)) {
      continue;
    }
    if (entry.name.startsWith(".") && entry.name !== ".") {
      // skip dotdirs except we already handle .git via ignore
      if (entry.isDirectory()) {
        continue;
      }
    }
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) {
      await walk(full, ignore, out);
    } else if (entry.isFile() && isSupportedExtension(extensionOf(entry.name))) {
      out.push(full);
    }
  }
}
