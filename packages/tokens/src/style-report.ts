import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractClassOccurrences, tokenizeClasses } from "@tailwind-canonicalize/parser";
import { parseUtility, utilityIdentity } from "@tailwind-canonicalize/resolver";
import { extractStructuralHints } from "./context.js";
import { findDuplicateValueTokens, scanProjectTokens } from "./css-scan.js";
import { parseColorUtility } from "./palette.js";
import type { ThemeToken, TokenAlias } from "./types.js";

/** Property groups that carry a color (not size/position/etc.). */
const COLOR_PROPERTY_GROUPS = new Set([
  "text-color",
  "background-color",
  "border-color",
  "border-t-color",
  "border-r-color",
  "border-b-color",
  "border-l-color",
  "border-x-color",
  "border-y-color",
  "border-s-color",
  "border-e-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "ring-color",
  "divide-color",
  "fill",
  "stroke-color",
  "gradient-from",
  "gradient-via",
  "gradient-to",
  "accent",
  "caret",
  "decoration-color",
  "box-shadow-color",
  "drop-shadow-color",
  "inset-shadow-color",
]);

/** Channel prefixes stripped when mapping semantic utilities → CSS vars. */
const SEMANTIC_CHANNEL_PREFIXES = [
  "border-t-",
  "border-r-",
  "border-b-",
  "border-l-",
  "border-x-",
  "border-y-",
  "border-s-",
  "border-e-",
  "border-",
  "outline-",
  "divide-",
  "ring-",
  "from-",
  "via-",
  "to-",
  "accent-",
  "caret-",
  "decoration-",
  "stroke-",
  "fill-",
  "text-",
  "bg-",
  "shadow-",
] as const;

const MAX_UTILS_PER_FILE = 50;
const TOP_FILES_DEFAULT = 50;

export type StyleUtilityKind = "palette" | "semantic" | "arbitrary" | "other";

export interface StyleHitSample {
  file: string;
  line: number;
  column: number;
  tag: string | null;
  utility: string;
  componentHint?: string;
}

export interface StyleUtilityUsage {
  /** Full utility including variants, e.g. hover:text-black */
  utility: string;
  /** Base without variants/important */
  base: string;
  propertyGroup: string;
  /** Coarse channel: text | bg | border | ring | … */
  channel: string;
  kind: StyleUtilityKind;
  palette: string | null;
  shade: string | null;
  /** Variant segments without trailing colon, e.g. ["hover","dark"] */
  variants: string[];
  count: number;
  /** tag → hit count */
  tags: Record<string, number>;
  /** relative POSIX file → hit count */
  files: Record<string, number>;
  samples: StyleHitSample[];
}

export interface StyleTagUsage {
  tag: string;
  count: number;
  /** utility → count on this tag */
  utilities: Record<string, number>;
  /** propertyGroup → distinct bases */
  groups: Record<string, string[]>;
  drift: StyleDriftSignal[];
}

export interface StyleFileUsage {
  file: string;
  count: number;
  uniqueUtilities: number;
  uniqueBases: number;
  byChannel: Record<string, number>;
  byKind: Record<StyleUtilityKind, number>;
  /** utility → count (top N when truncated) */
  utilities: Record<string, number>;
  utilitiesTruncated?: boolean;
  tags: Record<string, number>;
  componentHint?: string;
  driftCount: number;
}

export interface StyleDirectoryUsage {
  directory: string;
  count: number;
  files: number;
  uniqueUtilities: number;
}

export interface StyleHealthScore {
  /** 0–100 heuristic: higher = more semantic / fewer hotspots */
  score: number;
  semanticRatio: number;
  paletteRatio: number;
  arbitraryRatio: number;
  mixedTagCount: number;
  highCardinalityChannels: string[];
  notes: string[];
}

export interface StyleDriftSignal {
  kind:
    | "multi-color-same-tag"
    | "mixed-palette-on-tag"
    | "semantic-and-raw-mix"
    | "high-cardinality-channel"
    | "unused-theme-token"
    | "missing-theme-token"
    | "raw-palette-hotspot";
  severity: "info" | "warn";
  tag?: string;
  channel?: string;
  file?: string;
  message: string;
  utilities?: string[];
  count?: number;
}

export interface StyleThemeColorToken {
  name: string;
  bare: string;
  values: { default?: string; light?: string; dark?: string };
  aliases: string[];
  sources: Array<{ file: string; selector?: string }>;
  usageCount: number;
  usedAs: string[];
}

export interface StyleThemeSection {
  filesScanned: string[];
  colorTokens: StyleThemeColorToken[];
  unusedColorTokens: string[];
  missingForSemanticUtilities: Array<{
    utility: string;
    suggestedCssVar: string;
    count: number;
  }>;
  duplicateValues: Array<{ value: string; tokens: string[] }>;
}

export interface StyleWorkflowSuggestion {
  id: string;
  kind:
    | "add-css-color-token"
    | "alias-existing-token"
    | "prefer-semantic-utility"
    | "review-file-hotspot"
    | "review-tag-drift";
  severity: "info" | "warn";
  title: string;
  detail: string;
  payload: {
    cssVar?: string;
    valueHint?: string;
    targetFiles?: string[];
    utilities?: string[];
    tag?: string;
    /** Safe for generateTheme / apply pipelines when true */
    applyable?: boolean;
  };
}

export interface StyleUsageReport {
  version: 2;
  generatedAt: string;
  /** POSIX-normalized project root */
  cwd: string;
  filesAnalyzed: number;
  scope: "colors";
  summary: {
    totalHits: number;
    uniqueUtilities: number;
    uniqueBases: number;
    uniqueTags: number;
    byChannel: Record<string, number>;
    byKind: Record<StyleUtilityKind, number>;
    byPalette: Record<string, number>;
    byShade: Record<string, number>;
    byVariant: Record<string, number>;
    topUtilities: Array<{ utility: string; count: number }>;
    topTags: Array<{ tag: string; count: number }>;
    topFiles: Array<{
      file: string;
      count: number;
      uniqueUtilities: number;
    }>;
    driftCount: number;
    health: StyleHealthScore;
  };
  utilities: StyleUtilityUsage[];
  byTag: StyleTagUsage[];
  byFile: StyleFileUsage[];
  byDirectory: StyleDirectoryUsage[];
  drift: StyleDriftSignal[];
  theme: StyleThemeSection;
  suggestions: StyleWorkflowSuggestion[];
}

export interface StyleReportOptions {
  cwd?: string;
  files: string[];
  /** Max samples kept per utility. Default 8 */
  maxSamplesPerUtility?: number;
  /** Relative paths in report. Default true */
  relativePaths?: boolean;
  /** Skip CSS theme scan (tests). Default false */
  skipThemeScan?: boolean;
}

/**
 * Normalize paths for portable JSON reports (always `/`, never `\`).
 */
export function toReportPath(file: string, cwd: string, relative = true): string {
  const raw = relative ? path.relative(cwd, file) || file : file;
  return raw.replace(/\\/g, "/");
}

function channelFromGroup(group: string, base: string): string {
  if (group.startsWith("border")) {
    return "border";
  }
  if (group.startsWith("gradient-")) {
    return group.replace("gradient-", "gradient-");
  }
  if (group === "text-color") {
    return "text";
  }
  if (group === "background-color") {
    return "bg";
  }
  if (group === "ring-color") {
    return "ring";
  }
  if (group === "outline-color") {
    return "outline";
  }
  if (group === "divide-color") {
    return "divide";
  }
  if (group === "fill") {
    return "fill";
  }
  if (group === "stroke-color") {
    return "stroke";
  }
  if (group.includes("shadow")) {
    return "shadow";
  }
  if (group === "decoration-color") {
    return "decoration";
  }
  if (group === "accent") {
    return "accent";
  }
  if (group === "caret") {
    return "caret";
  }
  const head = base.split("-")[0] ?? group;
  return head;
}

function classifyKind(
  tokenBase: string,
  group: string,
  palette: ReturnType<typeof parseColorUtility>,
): StyleUtilityKind {
  if (palette) {
    return "palette";
  }
  if (tokenBase.includes("[")) {
    return "arbitrary";
  }
  if (group.endsWith("-color") || group === "fill" || group.startsWith("gradient-")) {
    return "semantic";
  }
  return "other";
}

function isColorStyleToken(token: string): {
  propertyGroup: string;
  base: string;
  utility: string;
} | null {
  const id = utilityIdentity(token);
  if (!COLOR_PROPERTY_GROUPS.has(id.propertyGroup)) {
    return null;
  }
  const parts = parseUtility(token);
  const base = parts.base.startsWith("-") ? parts.base.slice(1) : parts.base;
  return {
    propertyGroup: id.propertyGroup,
    base,
    utility: token,
  };
}

function parseVariantKeys(token: string): string[] {
  const parts = parseUtility(token);
  const raw = parts.variants.replace(/:$/, "");
  if (!raw) {
    return ["base"];
  }
  return raw.split(":").filter(Boolean);
}

/**
 * Map color utility base → semantic bare name for CSS var matching.
 * `bg-background` → `background`, `text-muted-foreground` → `muted-foreground`.
 */
export function semanticBareFromBase(base: string): string | null {
  let rest = base;
  for (const prefix of SEMANTIC_CHANNEL_PREFIXES) {
    if (rest.startsWith(prefix)) {
      rest = rest.slice(prefix.length);
      break;
    }
  }
  if (!rest || rest.includes("[")) {
    return null;
  }
  // Skip pure palette bases (blue-500, slate-200, black, white)
  if (parseColorUtility(base)) {
    return null;
  }
  return rest;
}

function bareFromCssVar(name: string): string {
  return name
    .replace(/^--color-/, "")
    .replace(/^--/, "")
    .replace(/^color-/, "");
}

function emptyKindCounts(): Record<StyleUtilityKind, number> {
  return { palette: 0, semantic: 0, arbitrary: 0, other: 0 };
}

function offsetToLineCol(source: string, offset: number): { line: number; column: number } {
  let line = 1;
  let col = 1;
  const end = Math.min(offset, source.length);
  for (let i = 0; i < end; i++) {
    if (source[i] === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, column: col };
}

function guessComponentName(file: string, source: string): string | undefined {
  const base = path.basename(file).replace(/\.[^.]+$/, "");
  if (base && base !== "index" && base !== "page") {
    return base;
  }
  const m = source.match(
    /(?:export\s+(?:default\s+)?(?:function|const)\s+|function\s+)([A-Z][A-Za-z0-9]*)/,
  );
  return m?.[1];
}

function directoryOf(file: string, depth = 3): string {
  const parts = file.split("/").filter(Boolean);
  if (parts.length <= 1) {
    return ".";
  }
  return parts.slice(0, Math.min(depth, parts.length - 1)).join("/");
}

function sortRecordDesc(map: Map<string, number>): Record<string, number> {
  return Object.fromEntries([...map.entries()].sort((a, b) => b[1] - a[1]));
}

function computeHealth(input: {
  totalHits: number;
  byKind: Record<StyleUtilityKind, number>;
  mixedTagCount: number;
  highCardinalityChannels: string[];
  unusedThemeCount: number;
  missingThemeCount: number;
  hotspotFileCount: number;
}): StyleHealthScore {
  const total = input.totalHits || 1;
  const semanticRatio = input.byKind.semantic / total;
  const paletteRatio = input.byKind.palette / total;
  const arbitraryRatio = input.byKind.arbitrary / total;
  const notes: string[] = [];
  let score = 100;

  if (paletteRatio > 0.7) {
    score -= 25;
    notes.push("High raw palette usage (>70% of color hits)");
  } else if (paletteRatio > 0.4) {
    score -= 12;
    notes.push("Moderate raw palette usage");
  }

  if (semanticRatio > 0.5) {
    notes.push("Majority semantic color utilities");
  }

  if (arbitraryRatio > 0.1) {
    score -= 8;
    notes.push("Notable arbitrary color values");
  }

  if (input.mixedTagCount > 0) {
    score -= Math.min(20, input.mixedTagCount * 2);
    notes.push(`${input.mixedTagCount} tag(s) mix semantic + palette colors`);
  }

  if (input.highCardinalityChannels.length > 0) {
    score -= Math.min(15, input.highCardinalityChannels.length * 5);
    notes.push(`High-cardinality channels: ${input.highCardinalityChannels.join(", ")}`);
  }

  if (input.unusedThemeCount > 0) {
    score -= Math.min(10, input.unusedThemeCount);
    notes.push(`${input.unusedThemeCount} unused theme color token(s)`);
  }

  if (input.missingThemeCount > 0) {
    score -= Math.min(15, input.missingThemeCount * 2);
    notes.push(`${input.missingThemeCount} semantic utilit(y/ies) missing CSS vars`);
  }

  if (input.hotspotFileCount > 0) {
    score -= Math.min(10, input.hotspotFileCount * 3);
    notes.push(`${input.hotspotFileCount} file hotspot(s) with many colors`);
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    semanticRatio: round4(semanticRatio),
    paletteRatio: round4(paletteRatio),
    arbitraryRatio: round4(arbitraryRatio),
    mixedTagCount: input.mixedTagCount,
    highCardinalityChannels: input.highCardinalityChannels,
    notes,
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function buildThemeSection(
  cwd: string,
  relativePaths: boolean,
  tokens: ThemeToken[],
  aliases: TokenAlias[],
  cssFiles: string[],
  utilities: StyleUtilityUsage[],
): StyleThemeSection {
  const aliasByFrom = new Map<string, string[]>();
  for (const a of aliases) {
    const list = aliasByFrom.get(a.from) ?? [];
    list.push(a.to);
    aliasByFrom.set(a.from, list);
  }

  // bare → usage from semantic utilities
  const bareUsage = new Map<string, { count: number; usedAs: Set<string> }>();
  for (const u of utilities) {
    if (u.kind !== "semantic") {
      continue;
    }
    const bare = semanticBareFromBase(u.base);
    if (!bare) {
      continue;
    }
    let entry = bareUsage.get(bare);
    if (!entry) {
      entry = { count: 0, usedAs: new Set() };
      bareUsage.set(bare, entry);
    }
    entry.count += u.count;
    entry.usedAs.add(u.utility);
  }

  const colorTokens: StyleThemeColorToken[] = tokens
    .filter((t) => t.namespace === "color" || t.name.startsWith("--color-"))
    .map((t) => {
      const bare = bareFromCssVar(t.name);
      const usage = bareUsage.get(bare);
      return {
        name: t.name,
        bare,
        values: {
          default: t.values.default,
          light: t.values.light,
          dark: t.values.dark,
        },
        aliases: aliasByFrom.get(t.name) ?? [],
        sources: t.sources.map((s) => ({
          file: s.file ? toReportPath(s.file, cwd, relativePaths) : "",
          selector: s.selector,
        })),
        usageCount: usage?.count ?? 0,
        usedAs: usage ? [...usage.usedAs].sort() : [],
      };
    })
    .sort((a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name));

  const knownBares = new Set(colorTokens.map((t) => t.bare));
  // Also index --foo when --color-foo exists
  for (const t of colorTokens) {
    knownBares.add(t.bare);
  }

  const unusedColorTokens = colorTokens.filter((t) => t.usageCount === 0).map((t) => t.name);

  const missingForSemanticUtilities: StyleThemeSection["missingForSemanticUtilities"] = [];
  for (const u of utilities) {
    if (u.kind !== "semantic") {
      continue;
    }
    const bare = semanticBareFromBase(u.base);
    if (!bare) {
      continue;
    }
    if (knownBares.has(bare)) {
      continue;
    }
    missingForSemanticUtilities.push({
      utility: u.utility,
      suggestedCssVar: `--color-${bare}`,
      count: u.count,
    });
  }
  missingForSemanticUtilities.sort((a, b) => b.count - a.count);

  const dups = findDuplicateValueTokens(tokens);
  const duplicateValues = dups.map((d) => ({
    value: d.values.light ?? d.values.dark ?? "",
    tokens: d.tokens,
  }));

  return {
    filesScanned: cssFiles.map((f) => toReportPath(f, cwd, relativePaths)),
    colorTokens,
    unusedColorTokens,
    missingForSemanticUtilities,
    duplicateValues,
  };
}

function buildSuggestions(input: {
  byFile: StyleFileUsage[];
  byTag: StyleTagUsage[];
  theme: StyleThemeSection;
  utilities: StyleUtilityUsage[];
}): StyleWorkflowSuggestion[] {
  const suggestions: StyleWorkflowSuggestion[] = [];
  let id = 0;
  const nextId = (prefix: string) => `${prefix}-${++id}`;

  for (const m of input.theme.missingForSemanticUtilities.slice(0, 40)) {
    suggestions.push({
      id: nextId("add-token"),
      kind: "add-css-color-token",
      severity: m.count >= 5 ? "warn" : "info",
      title: `Add CSS token ${m.suggestedCssVar}`,
      detail: `Semantic utility \`${m.utility}\` appears ${m.count} time(s) but no matching theme variable was found. Add it to globals.css / @theme for workflow apply.`,
      payload: {
        cssVar: m.suggestedCssVar,
        utilities: [m.utility],
        applyable: true,
      },
    });
  }

  for (const dup of input.theme.duplicateValues.slice(0, 15)) {
    if (dup.tokens.length < 2) {
      continue;
    }
    suggestions.push({
      id: nextId("alias"),
      kind: "alias-existing-token",
      severity: "info",
      title: `Review duplicate color values`,
      detail: `Tokens ${dup.tokens.join(", ")} share value ${dup.value}. Prefer an explicit alias rather than silent merge.`,
      payload: {
        cssVar: dup.tokens[0],
        valueHint: dup.value,
        utilities: dup.tokens,
        applyable: false,
      },
    });
  }

  for (const f of input.byFile) {
    if (f.uniqueBases >= 12 || (f.count >= 20 && f.byKind.palette >= f.count * 0.8)) {
      suggestions.push({
        id: nextId("file-hotspot"),
        kind: "review-file-hotspot",
        severity: f.uniqueBases >= 20 ? "warn" : "info",
        title: `Review color hotspot ${f.file}`,
        detail: `${f.count} color hits · ${f.uniqueBases} distinct bases — candidate for semantic tokens.`,
        payload: {
          targetFiles: [f.file],
          applyable: false,
        },
      });
    }
  }

  for (const t of input.byTag) {
    if (t.drift.some((d) => d.kind === "semantic-and-raw-mix")) {
      suggestions.push({
        id: nextId("tag-drift"),
        kind: "review-tag-drift",
        severity: "info",
        title: `Tag <${t.tag}> mixes semantic and palette colors`,
        detail: `Normalize <${t.tag}> toward design tokens for consistent surfaces.`,
        payload: {
          tag: t.tag,
          utilities: Object.keys(t.utilities).slice(0, 12),
          applyable: false,
        },
      });
    }
  }

  // High-count palette utilities → prefer semantic
  for (const u of input.utilities) {
    if (u.kind === "palette" && u.count >= 8) {
      suggestions.push({
        id: nextId("prefer-sem"),
        kind: "prefer-semantic-utility",
        severity: u.count >= 20 ? "warn" : "info",
        title: `Consider semantic replacement for ${u.utility}`,
        detail: `Raw palette utility appears ${u.count} time(s). Map via tokens analyze/apply when role is clear.`,
        payload: {
          utilities: [u.utility],
          targetFiles: Object.keys(u.files).slice(0, 10),
          applyable: false,
        },
      });
    }
  }

  // Cap noise
  return suggestions.slice(0, 80);
}

/**
 * Build a project-wide styling usage report for color utilities
 * (text-*, bg-*, border-*, ring-*, fill, stroke, gradients, …)
 * with HTML/JSX tag attribution, file indexes, theme CSS analysis,
 * and workflow-ready suggestions.
 */
export async function buildStyleUsageReport(
  options: StyleReportOptions,
): Promise<StyleUsageReport> {
  const cwd = options.cwd ?? process.cwd();
  const maxSamples = options.maxSamplesPerUtility ?? 8;
  const rel = options.relativePaths !== false;
  const reportCwd = cwd.replace(/\\/g, "/");

  type Acc = {
    utility: string;
    base: string;
    propertyGroup: string;
    channel: string;
    kind: StyleUtilityKind;
    palette: string | null;
    shade: string | null;
    variants: string[];
    count: number;
    tags: Map<string, number>;
    files: Map<string, number>;
    samples: StyleHitSample[];
  };

  type FileAcc = {
    count: number;
    utilities: Map<string, number>;
    bases: Set<string>;
    byChannel: Map<string, number>;
    byKind: Record<StyleUtilityKind, number>;
    tags: Map<string, number>;
    componentHint?: string;
  };

  const byUtility = new Map<string, Acc>();
  const byFileMap = new Map<string, FileAcc>();
  const byPalette = new Map<string, number>();
  const byShade = new Map<string, number>();
  const byVariant = new Map<string, number>();
  let filesAnalyzed = 0;

  for (const file of options.files) {
    let source: string;
    try {
      source = await readFile(file, "utf8");
    } catch {
      continue;
    }
    filesAnalyzed++;
    const relFile = toReportPath(file, cwd, rel);
    const componentHint = guessComponentName(file, source);
    const { occurrences } = extractClassOccurrences(source, {
      filePath: file,
    });

    let fileAcc = byFileMap.get(relFile);
    if (!fileAcc) {
      fileAcc = {
        count: 0,
        utilities: new Map(),
        bases: new Set(),
        byChannel: new Map(),
        byKind: emptyKindCounts(),
        tags: new Map(),
        componentHint,
      };
      byFileMap.set(relFile, fileAcc);
    } else if (componentHint && !fileAcc.componentHint) {
      fileAcc.componentHint = componentHint;
    }

    for (const occ of occurrences) {
      const tokens = tokenizeClasses(occ.raw);
      let searchFrom = 0;
      for (const token of tokens) {
        const classified = isColorStyleToken(token);
        if (!classified) {
          continue;
        }

        const relTok = occ.raw.indexOf(token, searchFrom);
        const offset = relTok === -1 ? occ.start : occ.start + relTok;
        if (relTok !== -1) {
          searchFrom = relTok + token.length;
        }
        const { line, column } = offsetToLineCol(source, offset);
        const nearby = source.slice(
          Math.max(0, offset - 240),
          Math.min(source.length, offset + 80),
        );
        const structural = extractStructuralHints(nearby);
        const tag = structural.elementName ?? null;

        const palette = parseColorUtility(token);
        const kind = classifyKind(classified.base, classified.propertyGroup, palette);
        const channel = channelFromGroup(classified.propertyGroup, classified.base);
        const variantKeys = parseVariantKeys(token);

        const key = classified.utility;
        let acc = byUtility.get(key);
        if (!acc) {
          acc = {
            utility: key,
            base: classified.base,
            propertyGroup: classified.propertyGroup,
            channel,
            kind,
            palette: palette?.palette ?? null,
            shade: palette?.shade ?? null,
            variants: variantKeys.filter((v) => v !== "base"),
            count: 0,
            tags: new Map(),
            files: new Map(),
            samples: [],
          };
          byUtility.set(key, acc);
        }
        acc.count++;
        const tagKey = tag ?? "(unknown)";
        acc.tags.set(tagKey, (acc.tags.get(tagKey) ?? 0) + 1);
        acc.files.set(relFile, (acc.files.get(relFile) ?? 0) + 1);
        if (acc.samples.length < maxSamples) {
          acc.samples.push({
            file: relFile,
            line,
            column,
            tag,
            utility: token,
            componentHint,
          });
        }

        // File index
        fileAcc.count++;
        fileAcc.utilities.set(key, (fileAcc.utilities.get(key) ?? 0) + 1);
        fileAcc.bases.add(classified.base);
        fileAcc.byChannel.set(channel, (fileAcc.byChannel.get(channel) ?? 0) + 1);
        fileAcc.byKind[kind]++;
        fileAcc.tags.set(tagKey, (fileAcc.tags.get(tagKey) ?? 0) + 1);

        // Global rollups
        if (palette?.palette) {
          byPalette.set(palette.palette, (byPalette.get(palette.palette) ?? 0) + 1);
        }
        if (palette?.shade) {
          byShade.set(palette.shade, (byShade.get(palette.shade) ?? 0) + 1);
        }
        for (const v of variantKeys) {
          byVariant.set(v, (byVariant.get(v) ?? 0) + 1);
        }
      }
    }
  }

  const utilities: StyleUtilityUsage[] = [...byUtility.values()]
    .map((a) => ({
      utility: a.utility,
      base: a.base,
      propertyGroup: a.propertyGroup,
      channel: a.channel,
      kind: a.kind,
      palette: a.palette,
      shade: a.shade,
      variants: a.variants,
      count: a.count,
      tags: sortRecordDesc(a.tags),
      files: sortRecordDesc(a.files),
      samples: a.samples,
    }))
    .sort((a, b) => b.count - a.count || a.utility.localeCompare(b.utility));

  // byTag
  const tagMap = new Map<
    string,
    {
      count: number;
      utilities: Map<string, number>;
      groups: Map<string, Set<string>>;
    }
  >();

  for (const u of utilities) {
    for (const [tag, n] of Object.entries(u.tags)) {
      let t = tagMap.get(tag);
      if (!t) {
        t = { count: 0, utilities: new Map(), groups: new Map() };
        tagMap.set(tag, t);
      }
      t.count += n;
      t.utilities.set(u.utility, (t.utilities.get(u.utility) ?? 0) + n);
      let g = t.groups.get(u.propertyGroup);
      if (!g) {
        g = new Set();
        t.groups.set(u.propertyGroup, g);
      }
      g.add(u.base);
    }
  }

  const drift: StyleDriftSignal[] = [];
  const byTag: StyleTagUsage[] = [...tagMap.entries()]
    .map(([tag, t]) => {
      const tagDrift: StyleDriftSignal[] = [];
      for (const [group, bases] of t.groups) {
        if (bases.size >= 3 && COLOR_PROPERTY_GROUPS.has(group)) {
          const list = [...bases].slice(0, 12);
          const signal: StyleDriftSignal = {
            kind: "multi-color-same-tag",
            severity: bases.size >= 6 ? "warn" : "info",
            tag,
            channel: group,
            message: `Tag <${tag}> uses ${bases.size} distinct ${group} values — possible styling drift`,
            utilities: list,
            count: bases.size,
          };
          tagDrift.push(signal);
          drift.push(signal);
        }
      }

      const utilsOnTag = [...t.utilities.keys()];
      const kinds = new Set(
        utilsOnTag.map((name) => {
          const hit = utilities.find((u) => u.utility === name);
          return hit?.kind ?? "other";
        }),
      );
      if (kinds.has("palette") && kinds.has("semantic")) {
        const signal: StyleDriftSignal = {
          kind: "semantic-and-raw-mix",
          severity: "info",
          tag,
          message: `Tag <${tag}> mixes semantic tokens and raw palette colors`,
          utilities: utilsOnTag.slice(0, 10),
        };
        tagDrift.push(signal);
        drift.push(signal);
      }

      const palettes = new Set(
        utilsOnTag
          .map((name) => utilities.find((u) => u.utility === name)?.palette)
          .filter((p): p is string => Boolean(p) && p !== "transparent"),
      );
      if (palettes.size >= 2) {
        const signal: StyleDriftSignal = {
          kind: "mixed-palette-on-tag",
          severity: palettes.size >= 5 ? "warn" : "info",
          tag,
          message: `Tag <${tag}> uses ${palettes.size} palette families (${[...palettes].slice(0, 8).join(", ")})`,
          count: palettes.size,
        };
        tagDrift.push(signal);
        drift.push(signal);
      }

      return {
        tag,
        count: t.count,
        utilities: sortRecordDesc(t.utilities),
        groups: Object.fromEntries([...t.groups.entries()].map(([g, set]) => [g, [...set].sort()])),
        drift: tagDrift,
      };
    })
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  // High cardinality channels project-wide
  const channelBases = new Map<string, Set<string>>();
  for (const u of utilities) {
    let s = channelBases.get(u.channel);
    if (!s) {
      s = new Set();
      channelBases.set(u.channel, s);
    }
    s.add(u.base);
  }
  const highCardinalityChannels: string[] = [];
  for (const [channel, bases] of channelBases) {
    if (bases.size >= 15) {
      highCardinalityChannels.push(channel);
      drift.push({
        kind: "high-cardinality-channel",
        severity: bases.size >= 30 ? "warn" : "info",
        channel,
        message: `Channel "${channel}" has ${bases.size} distinct color utilities project-wide`,
        count: bases.size,
        utilities: [...bases].slice(0, 15),
      });
    }
  }

  // File hotspots
  for (const [file, f] of byFileMap) {
    if (f.bases.size >= 12) {
      drift.push({
        kind: "raw-palette-hotspot",
        severity: f.bases.size >= 20 ? "warn" : "info",
        file,
        message: `File ${file} uses ${f.bases.size} distinct color bases (${f.count} hits)`,
        count: f.bases.size,
        utilities: [...f.utilities.keys()].slice(0, 15),
      });
    }
  }

  // byFile export
  const byFile: StyleFileUsage[] = [...byFileMap.entries()]
    .map(([file, f]) => {
      const sortedUtils = [...f.utilities.entries()].sort((a, b) => b[1] - a[1]);
      const truncated = sortedUtils.length > MAX_UTILS_PER_FILE;
      const topUtils = sortedUtils.slice(0, MAX_UTILS_PER_FILE);
      return {
        file,
        count: f.count,
        uniqueUtilities: f.utilities.size,
        uniqueBases: f.bases.size,
        byChannel: sortRecordDesc(f.byChannel),
        byKind: { ...f.byKind },
        utilities: Object.fromEntries(topUtils),
        utilitiesTruncated: truncated || undefined,
        tags: sortRecordDesc(f.tags),
        componentHint: f.componentHint,
        driftCount: drift.filter((d) => d.file === file).length,
      };
    })
    .filter((f) => f.count > 0)
    .sort((a, b) => b.count - a.count || a.file.localeCompare(b.file));

  // byDirectory
  const dirMap = new Map<string, { count: number; files: Set<string>; utilities: Set<string> }>();
  for (const f of byFile) {
    const dir = directoryOf(f.file);
    let d = dirMap.get(dir);
    if (!d) {
      d = { count: 0, files: new Set(), utilities: new Set() };
      dirMap.set(dir, d);
    }
    d.count += f.count;
    d.files.add(f.file);
    for (const u of Object.keys(f.utilities)) {
      d.utilities.add(u);
    }
  }
  const byDirectory: StyleDirectoryUsage[] = [...dirMap.entries()]
    .map(([directory, d]) => ({
      directory,
      count: d.count,
      files: d.files.size,
      uniqueUtilities: d.utilities.size,
    }))
    .sort((a, b) => b.count - a.count || a.directory.localeCompare(b.directory));

  const byChannel: Record<string, number> = {};
  const byKind = emptyKindCounts();
  let totalHits = 0;
  const uniqueBases = new Set<string>();
  for (const u of utilities) {
    totalHits += u.count;
    uniqueBases.add(u.base);
    byChannel[u.channel] = (byChannel[u.channel] ?? 0) + u.count;
    byKind[u.kind] = (byKind[u.kind] ?? 0) + u.count;
  }

  // Theme CSS analysis
  let theme: StyleThemeSection = {
    filesScanned: [],
    colorTokens: [],
    unusedColorTokens: [],
    missingForSemanticUtilities: [],
    duplicateValues: [],
  };
  if (!options.skipThemeScan) {
    try {
      const scanned = await scanProjectTokens(cwd);
      theme = buildThemeSection(
        cwd,
        rel,
        scanned.tokens,
        scanned.aliases,
        scanned.files,
        utilities,
      );
    } catch {
      // Theme scan is best-effort; report still valid without it
    }
  }

  for (const name of theme.unusedColorTokens.slice(0, 40)) {
    drift.push({
      kind: "unused-theme-token",
      severity: "info",
      message: `Theme token ${name} is defined in CSS but never used as a semantic color utility`,
      utilities: [name],
    });
  }
  for (const m of theme.missingForSemanticUtilities.slice(0, 40)) {
    drift.push({
      kind: "missing-theme-token",
      severity: m.count >= 5 ? "warn" : "info",
      message: `Semantic utility ${m.utility} has no matching CSS var (suggest ${m.suggestedCssVar})`,
      utilities: [m.utility],
      count: m.count,
    });
  }

  const mixedTagCount = byTag.filter((t) =>
    t.drift.some((d) => d.kind === "semantic-and-raw-mix"),
  ).length;
  const hotspotFileCount = byFile.filter((f) => f.uniqueBases >= 12).length;

  const health = computeHealth({
    totalHits,
    byKind,
    mixedTagCount,
    highCardinalityChannels,
    unusedThemeCount: theme.unusedColorTokens.length,
    missingThemeCount: theme.missingForSemanticUtilities.length,
    hotspotFileCount,
  });

  const suggestions = buildSuggestions({
    byFile,
    byTag,
    theme,
    utilities,
  });

  const sortedDrift = drift.sort((a, b) => {
    const sev = (s: StyleDriftSignal["severity"]) => (s === "warn" ? 0 : 1);
    return sev(a.severity) - sev(b.severity);
  });

  return {
    version: 2,
    generatedAt: new Date().toISOString(),
    cwd: reportCwd,
    filesAnalyzed,
    scope: "colors",
    summary: {
      totalHits,
      uniqueUtilities: utilities.length,
      uniqueBases: uniqueBases.size,
      uniqueTags: byTag.length,
      byChannel,
      byKind,
      byPalette: sortRecordDesc(byPalette),
      byShade: sortRecordDesc(byShade),
      byVariant: sortRecordDesc(byVariant),
      topUtilities: utilities.slice(0, 25).map((u) => ({
        utility: u.utility,
        count: u.count,
      })),
      topTags: byTag.slice(0, 25).map((t) => ({
        tag: t.tag,
        count: t.count,
      })),
      topFiles: byFile.slice(0, TOP_FILES_DEFAULT).map((f) => ({
        file: f.file,
        count: f.count,
        uniqueUtilities: f.uniqueUtilities,
      })),
      driftCount: sortedDrift.length,
      health,
    },
    utilities,
    byTag,
    byFile,
    byDirectory,
    drift: sortedDrift,
    theme,
    suggestions,
  };
}

export async function writeStyleUsageReport(
  outPath: string,
  report: StyleUsageReport,
): Promise<void> {
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

/** Compact markdown summary for PRs / notes. */
export function formatStyleUsageReportMarkdown(report: StyleUsageReport): string {
  const h = report.summary.health;
  const lines: string[] = [
    `# Style usage report`,
    ``,
    `Generated: ${report.generatedAt}`,
    `Files: ${report.filesAnalyzed} · Hits: ${report.summary.totalHits} · Unique utilities: ${report.summary.uniqueUtilities}`,
    `Health: **${h.score}/100** · semantic ${pct(h.semanticRatio)} · palette ${pct(h.paletteRatio)} · arbitrary ${pct(h.arbitraryRatio)}`,
    ``,
  ];

  if (h.notes.length > 0) {
    lines.push(`### Health notes`, ``);
    for (const n of h.notes) {
      lines.push(`- ${n}`);
    }
    lines.push(``);
  }

  lines.push(`## Top utilities`, ``, `| Utility | Count |`, `|---------|------:|`);
  for (const u of report.summary.topUtilities.slice(0, 20)) {
    lines.push(`| \`${u.utility}\` | ${u.count} |`);
  }

  lines.push(``, `## Top files`, ``, `| File | Hits | Unique |`, `|------|-----:|-------:|`);
  for (const f of report.summary.topFiles.slice(0, 20)) {
    lines.push(`| \`${f.file}\` | ${f.count} | ${f.uniqueUtilities} |`);
  }

  lines.push(``, `## Top tags`, ``, `| Tag | Color hits |`, `|-----|----------:|`);
  for (const t of report.summary.topTags.slice(0, 15)) {
    lines.push(`| \`<${t.tag}>\` | ${t.count} |`);
  }

  const palettes = Object.entries(report.summary.byPalette).slice(0, 12);
  if (palettes.length > 0) {
    lines.push(``, `## Palettes`, ``, `| Palette | Hits |`, `|---------|-----:|`);
    for (const [p, n] of palettes) {
      lines.push(`| \`${p}\` | ${n} |`);
    }
  }

  const variants = Object.entries(report.summary.byVariant).slice(0, 12);
  if (variants.length > 0) {
    lines.push(``, `## Variants`, ``, `| Variant | Hits |`, `|---------|-----:|`);
    for (const [v, n] of variants) {
      lines.push(`| \`${v}\` | ${n} |`);
    }
  }

  if (report.theme.colorTokens.length > 0 || report.theme.filesScanned.length > 0) {
    lines.push(
      ``,
      `## Theme CSS`,
      ``,
      `Scanned ${report.theme.filesScanned.length} CSS file(s) · ${report.theme.colorTokens.length} color token(s)`,
      ``,
    );
    if (report.theme.missingForSemanticUtilities.length > 0) {
      lines.push(
        `### Missing CSS vars for semantic utilities`,
        ``,
        `| Utility | Suggested var | Count |`,
        `|---------|---------------|------:|`,
      );
      for (const m of report.theme.missingForSemanticUtilities.slice(0, 20)) {
        lines.push(`| \`${m.utility}\` | \`${m.suggestedCssVar}\` | ${m.count} |`);
      }
      lines.push(``);
    }
    if (report.theme.unusedColorTokens.length > 0) {
      lines.push(`### Unused theme tokens`, ``);
      for (const name of report.theme.unusedColorTokens.slice(0, 20)) {
        lines.push(`- \`${name}\``);
      }
      lines.push(``);
    }
  }

  if (report.suggestions.length > 0) {
    lines.push(``, `## Workflow suggestions`, ``);
    for (const s of report.suggestions.slice(0, 25)) {
      lines.push(`- **${s.severity}** \`${s.kind}\` — ${s.title}: ${s.detail}`);
    }
    lines.push(``);
  }

  if (report.drift.length > 0) {
    lines.push(``, `## Drift signals`, ``);
    for (const d of report.drift.slice(0, 30)) {
      lines.push(`- **${d.severity}** — ${d.message}`);
    }
  }
  lines.push(``);
  return lines.join("\n");
}

function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
