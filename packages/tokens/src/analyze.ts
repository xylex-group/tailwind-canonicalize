import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractClassOccurrences, tokenizeClasses } from "@tailwind-canonicalize/parser";
import {
  buildTargetUtility,
  DEFAULT_PALETTE_HEX,
  extractStructuralHints,
  inferContextSignals,
  proposeSemanticToken,
} from "./context.js";
import { findAliasCycles, findDuplicateValueTokens, scanProjectTokens } from "./css-scan.js";
import { parseColorUtility } from "./palette.js";
import type {
  ColorAnalysisEntry,
  ColorOccurrence,
  CombinationAnalysis,
  SemanticColorRecipe,
  ThemePairMapping,
  TokenAnalyzeResult,
  TokenManifest,
} from "./types.js";
import { DEFAULT_RECIPES } from "./types.js";

export interface AnalyzeOptions {
  cwd?: string;
  files: string[];
  /** Minimum confidence to include in proposed manifest mappings. Default 0.75 */
  minConfidence?: number;
}

/**
 * Phase 1: analyze color utilities project-wide. Never writes source.
 * Semantic meaning is architectural — proposals only, never applied here.
 */
export async function analyzeColorTokens(options: AnalyzeOptions): Promise<TokenAnalyzeResult> {
  const cwd = options.cwd ?? process.cwd();
  const minConfidence = options.minConfidence ?? 0.75;

  const byUtility = new Map<string, ColorOccurrence[]>();
  const combinationCounts = new Map<string, number>();

  for (const file of options.files) {
    let source: string;
    try {
      source = await readFile(file, "utf8");
    } catch {
      continue;
    }
    const { occurrences } = extractClassOccurrences(source, { filePath: file });
    const componentHint = guessComponentName(file, source);

    for (const occ of occurrences) {
      const tokens = tokenizeClasses(occ.raw);
      const colorTokens = tokens
        .map((t) => ({ token: t, color: parseColorUtility(t) }))
        .filter(
          (x): x is { token: string; color: NonNullable<typeof x.color> } => x.color !== null,
        );

      const siblingBases = colorTokens.map((c) => c.color.base);
      if (siblingBases.length >= 2) {
        const key = [...siblingBases].sort().join(" ");
        combinationCounts.set(key, (combinationCounts.get(key) ?? 0) + 1);
      }

      let searchFrom = 0;
      for (const { token, color } of colorTokens) {
        const rel = occ.raw.indexOf(token, searchFrom);
        const offset = rel === -1 ? occ.start : occ.start + rel;
        if (rel !== -1) {
          searchFrom = rel + token.length;
        }
        const { line, column } = offsetToLineCol(source, offset);
        const nearby = source.slice(
          Math.max(0, offset - 280),
          Math.min(source.length, offset + 280),
        );
        const structural = extractStructuralHints(nearby);
        const signals = inferContextSignals({
          filePath: file,
          nearbySource: nearby,
          utility: token,
          componentName: componentHint,
          elementName: structural.elementName,
          ariaRole: structural.ariaRole,
          cvaVariant: structural.cvaVariant,
        });

        // Sibling combination boosts warning surface etc.
        if (
          siblingBases.includes("bg-amber-200") &&
          (color.base.startsWith("bg-amber") ||
            color.base.startsWith("border-amber") ||
            color.base.startsWith("text-slate"))
        ) {
          signals.push("warning");
        }

        const entry: ColorOccurrence = {
          file,
          line,
          column,
          utility: token,
          base: color.base,
          property: color.property,
          palette: color.palette,
          shade: color.shade,
          componentHint,
          elementHint: structural.elementName,
          ariaRole: structural.ariaRole,
          cvaVariant: structural.cvaVariant,
          siblingBases,
          contextSignals: [...new Set(signals)],
        };

        const list = byUtility.get(color.base) ?? [];
        list.push(entry);
        byUtility.set(color.base, list);
      }
    }
  }

  const colors: ColorAnalysisEntry[] = [];
  const proposedMappings: TokenManifest["mappings"] = [];

  for (const [sourceUtility, samples] of byUtility) {
    const contexts: Record<string, number> = {};
    for (const s of samples) {
      for (const sig of s.contextSignals) {
        contexts[sig] = (contexts[sig] ?? 0) + 1;
      }
    }

    const sortedRoles = Object.entries(contexts).sort((a, b) => b[1] - a[1]);
    const dominant = sortedRoles[0]?.[0] ?? null;
    const totalSignals = Object.values(contexts).reduce((a, b) => a + b, 0) || 1;
    const dominantCount = sortedRoles[0]?.[1] ?? 0;
    let confidence = dominantCount / totalSignals;

    if (
      samples.some(
        (s) => s.componentHint && dominant && s.componentHint.toLowerCase().includes(dominant),
      )
    ) {
      confidence = Math.min(1, confidence + 0.15);
    }
    if (samples.some((s) => s.cvaVariant && dominant && s.cvaVariant.includes(dominant))) {
      confidence = Math.min(1, confidence + 0.1);
    }
    if (samples.some((s) => s.ariaRole === "alert")) {
      confidence = Math.min(1, confidence + 0.1);
    }

    const roleCount = sortedRoles.filter(([, n]) => n >= 2).length;
    if (roleCount > 1) {
      confidence *= 0.7;
    }

    // Dynamic / generated class penalty
    if (samples.some((s) => s.utility.includes("${") || s.file.includes(".gen."))) {
      confidence *= 0.3;
    }

    const first = samples[0]!;
    const proposal = proposeSemanticToken(first.property, first.palette, first.shade, dominant);

    const conflictFiles = new Map<string, string>();
    if (roleCount > 1) {
      for (const s of samples) {
        const other = s.contextSignals.find((x) => x !== dominant);
        if (other) {
          conflictFiles.set(s.file, `Also signals '${other}' context`);
        }
      }
    }

    const entry: ColorAnalysisEntry = {
      sourceUtility,
      occurrences: samples.length,
      contexts,
      proposal: proposal ? { token: proposal.token, cssVariable: proposal.cssVariable } : null,
      confidence: Math.round(confidence * 100) / 100,
      conflicts: [...conflictFiles].map(([file, reason]) => ({ file, reason })),
      samples: samples.slice(0, 5),
    };
    colors.push(entry);

    if (proposal && confidence >= minConfidence && conflictFiles.size === 0) {
      proposedMappings.push({
        source: sourceUtility,
        target: buildTargetUtility(first.property, proposal.token),
        token: proposal.cssVariable,
        category: "semantic-color-token",
        confidence: entry.confidence,
      });
    }
  }

  colors.sort((a, b) => b.occurrences - a.occurrences);

  // Combinations → recipes
  const combinations: CombinationAnalysis[] = [];
  const proposedRecipes: SemanticColorRecipe[] = [];
  for (const [key, count] of combinationCounts) {
    const bases = key.split(" ");
    let proposedRecipe: string | null = null;
    let conf = Math.min(1, count / 10);

    for (const recipe of DEFAULT_RECIPES) {
      if (!recipe.sources) {
        continue;
      }
      const sources = Object.values(recipe.sources).filter(Boolean) as string[];
      if (sources.every((s) => bases.includes(s))) {
        proposedRecipe = recipe.name;
        conf = Math.min(1, conf + 0.4);
        if (count >= 1 && !proposedRecipes.some((r) => r.name === recipe.name)) {
          proposedRecipes.push(recipe);
        }
      }
    }

    combinations.push({
      bases,
      count,
      proposedRecipe,
      confidence: Math.round(conf * 100) / 100,
    });
  }
  combinations.sort((a, b) => b.count - a.count);

  // Dark pairs: look for bg-white + dark:bg-slate-950 co-occurrence patterns in raw
  const proposedPairs = proposeDarkPairs(byUtility);

  const { tokens, aliases } = await scanProjectTokens(cwd);
  const cycles = findAliasCycles(aliases);
  const duplicates = findDuplicateValueTokens(tokens);

  // Prefer existing tokens
  for (const m of proposedMappings) {
    const existing = tokens.find(
      (t) =>
        t.name === m.token ||
        t.name === m.token?.replace(/^--color-/, "--") ||
        t.name === `--${m.token?.replace(/^--color-/, "")}`,
    );
    if (existing) {
      // Reuse --warning-subtle as --color-warning-subtle via alias generation later
      if (!existing.name.startsWith("--color-") && m.token) {
        m.token = m.token.startsWith("--color-")
          ? m.token
          : `--color-${m.token.replace(/^--/, "")}`;
      }
    }
  }

  // Mark pairs proven when both light and dark token values exist
  for (const pair of proposedPairs) {
    const tokenName = pair.token ?? "--color-background";
    const existing = tokens.find(
      (t) => t.name === tokenName || t.name === tokenName.replace(/^--color-/, "--"),
    );
    if (existing?.values.light && existing?.values.dark) {
      pair.proven = true;
    } else {
      // Manifest pairs are user-approved; proposals start unproven until theme gen
      pair.proven = false;
    }
  }

  const themeValues: NonNullable<TokenManifest["generateTheme"]>["values"] = {};
  for (const m of proposedMappings) {
    if (!m.token) {
      continue;
    }
    const name = m.token.replace(/^--color-/, "");
    const light = DEFAULT_PALETTE_HEX[m.source];
    if (light) {
      themeValues[name] = { light, default: light };
    }
  }
  for (const pair of proposedPairs) {
    const name = (pair.token ?? "--color-background").replace(/^--color-/, "");
    themeValues[name] = {
      light: DEFAULT_PALETTE_HEX[pair.light],
      dark: DEFAULT_PALETTE_HEX[pair.dark],
      default: DEFAULT_PALETTE_HEX[pair.light],
    };
  }

  const proposedManifest: TokenManifest = {
    $schema: "./node_modules/tailwind-canonicalize/schema/tokens.schema.json",
    version: 1,
    mappings: proposedMappings,
    pairs: proposedPairs.filter((p) => p.proven !== false || true),
    recipes: proposedRecipes,
    generateTheme: {
      preferAppAliases: true,
      dualTheme: proposedPairs.length > 0,
      values: themeValues,
    },
  };

  return {
    colors,
    combinations,
    existingTokens: tokens,
    aliases,
    duplicates,
    cycles,
    proposedManifest,
    proposedPairs,
    proposedRecipes,
  };
}

function proposeDarkPairs(byUtility: Map<string, ColorOccurrence[]>): ThemePairMapping[] {
  const pairs: ThemePairMapping[] = [];

  // Common surface pair
  if (byUtility.has("bg-white")) {
    // dark:bg-slate-950 appears as base bg-slate-950 with dark variant in utility field
    const hasDarkSlate = [...byUtility.values()].some((samples) =>
      samples.some(
        (s) =>
          s.base === "bg-slate-950" &&
          (s.utility.startsWith("dark:") || s.utility.includes("dark:")),
      ),
    );
    // Also if both bases exist project-wide
    if (hasDarkSlate || byUtility.has("bg-slate-950")) {
      pairs.push({
        light: "bg-white",
        dark: "bg-slate-950",
        target: "bg-background",
        token: "--color-background",
        proven: false,
      });
    }
  }

  if (byUtility.has("text-slate-800") && byUtility.has("text-slate-100")) {
    pairs.push({
      light: "text-slate-800",
      dark: "text-slate-100",
      target: "text-foreground",
      token: "--color-foreground",
      proven: false,
    });
  }

  if (byUtility.has("border-slate-200") && byUtility.has("border-slate-800")) {
    pairs.push({
      light: "border-slate-200",
      dark: "border-slate-800",
      target: "border-border",
      token: "--color-border",
      proven: false,
    });
  }

  return pairs;
}

function guessComponentName(file: string, source: string): string | undefined {
  const base = path.basename(file).replace(/\.[^.]+$/, "");
  if (/^[A-Z]/.test(base)) {
    return base;
  }
  const fn = source.match(/function\s+([A-Z][A-Za-z0-9_]*)/);
  if (fn?.[1]) {
    return fn[1];
  }
  const cl = source.match(/(?:const|export const)\s+([A-Z][A-Za-z0-9_]*)\s*=/);
  if (cl?.[1]) {
    return cl[1];
  }
  return base;
}

function offsetToLineCol(source: string, offset: number): { line: number; column: number } {
  let line = 1;
  let column = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return { line, column };
}
