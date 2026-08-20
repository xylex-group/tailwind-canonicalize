import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface FileHashEntry {
  hash: string;
  mtimeMs?: number;
  /** Hash of pipeline options that affect output */
  optionsHash: string;
}

export interface IncrementalCache {
  version: 1;
  optionsHash: string;
  files: Record<string, FileHashEntry>;
}

const CACHE_VERSION = 1 as const;
const DEFAULT_CACHE_NAME = ".tailwind-canonicalize-cache.json";

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 32);
}

export function hashOptions(obj: unknown): string {
  return hashContent(stableStringify(obj));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

export function cachePath(cwd: string, custom?: string): string {
  return path.isAbsolute(custom ?? "")
    ? (custom as string)
    : path.join(cwd, custom ?? DEFAULT_CACHE_NAME);
}

export async function loadCache(filePath: string): Promise<IncrementalCache> {
  try {
    const raw = await readFile(filePath, "utf8");
    const data = JSON.parse(raw) as IncrementalCache;
    if (data.version !== CACHE_VERSION || !data.files) {
      return emptyCache("");
    }
    return data;
  } catch {
    return emptyCache("");
  }
}

export function emptyCache(optionsHash: string): IncrementalCache {
  return { version: CACHE_VERSION, optionsHash, files: {} };
}

export async function saveCache(filePath: string, cache: IncrementalCache): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

/**
 * Returns true when file content is unchanged for the current options.
 */
export function isFileFresh(
  cache: IncrementalCache,
  absPath: string,
  contentHash: string,
  optionsHash: string,
): boolean {
  if (cache.optionsHash !== optionsHash) {
    return false;
  }
  const entry = cache.files[absPath];
  if (!entry) {
    return false;
  }
  return entry.hash === contentHash && entry.optionsHash === optionsHash;
}

export function markFile(
  cache: IncrementalCache,
  absPath: string,
  contentHash: string,
  optionsHash: string,
): void {
  cache.files[absPath] = {
    hash: contentHash,
    optionsHash,
  };
}

export function pruneCache(cache: IncrementalCache, keepPaths: Set<string>): void {
  for (const key of Object.keys(cache.files)) {
    if (!keepPaths.has(key)) {
      delete cache.files[key];
    }
  }
}
