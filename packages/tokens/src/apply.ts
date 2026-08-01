import { readFile, writeFile } from "node:fs/promises";
import type { TokenMapping, ThemePairMapping } from "@tailwind-canonicalize/resolver";
import type { SemanticColorRecipe, TokenManifest } from "./types.js";

/**
 * Load an approved token manifest from JSON.
 */
export async function loadTokenManifest(filePath: string): Promise<TokenManifest> {
  const raw = await readFile(filePath, "utf8");
  const data = JSON.parse(raw) as TokenManifest;
  if (data.version !== 1 || !Array.isArray(data.mappings)) {
    throw new Error(`Invalid token manifest: ${filePath}`);
  }
  return data;
}

/**
 * Convert manifest mappings to pipeline TokenMapping list.
 */
export function manifestToMappings(manifest: TokenManifest): TokenMapping[] {
  return manifest.mappings.map((m) => ({
    source: m.source,
    target: m.target,
    token: m.token,
    category: m.category ?? "semantic-color-token",
    confidence: m.confidence,
  }));
}

/**
 * Convert manifest pairs for dark-pair collapse.
 * Approved manifest pairs are treated as proven (user reviewed).
 */
export function manifestToPairs(manifest: TokenManifest): ThemePairMapping[] {
  return (manifest.pairs ?? []).map((p) => ({
    light: p.light,
    dark: p.dark,
    target: p.target,
    token: p.token,
    proven: p.proven !== false,
  }));
}

export function manifestToRecipes(manifest: TokenManifest): SemanticColorRecipe[] {
  return manifest.recipes ?? [];
}

/**
 * Write analysis proposal to a manifest file (no source rewrites).
 */
export async function writeTokenManifest(
  filePath: string,
  manifest: TokenManifest,
): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}
