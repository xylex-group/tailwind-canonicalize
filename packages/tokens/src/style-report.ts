import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  extractClassOccurrences,
  tokenizeClasses,
} from "@tailwind-canonicalize/parser";
import {
  parseUtility,
  utilityIdentity,
} from "@tailwind-canonicalize/resolver";
import { extractStructuralHints } from "./context.js";
import { parseColorUtility } from "./palette.js";

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
  count: number;
  /** tag → hit count */
  tags: Record<string, number>;
  /** relative file → hit count */
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

export interface StyleDriftSignal {
  kind:
    | "multi-color-same-tag"
    | "mixed-palette-on-tag"
    | "semantic-and-raw-mix"
    | "high-cardinality-channel";
  severity: "info" | "warn";
  tag?: string;
  channel?: string;
  message: string;
  utilities?: string[];
  count?: number;
}

export interface StyleUsageReport {
  version: 1;
  generatedAt: string;
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
    topUtilities: Array<{ utility: string; count: number }>;
    topTags: Array<{ tag: string; count: number }>;
    driftCount: number;
  };
  utilities: StyleUtilityUsage[];
  byTag: StyleTagUsage[];
  drift: StyleDriftSignal[];
}

export interface StyleReportOptions {
  cwd?: string;
  files: string[];
  /** Max samples kept per utility. Default 8 */
  maxSamplesPerUtility?: number;
  /** Relative paths in report. Default true */
  relativePaths?: boolean;
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
  // fallback from base prefix
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
  // semantic-ish: bg-background, text-primary, border-border
  if (
    group.endsWith("-color") ||
    group === "fill" ||
    group.startsWith("gradient-")
  ) {
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
  // gradient position groups are not in COLOR_PROPERTY_GROUPS
  const parts = parseUtility(token);
  const base = parts.base.startsWith("-") ? parts.base.slice(1) : parts.base;
  return {
    propertyGroup: id.propertyGroup,
    base,
    utility: token,
  };
}

function offsetToLineCol(
  source: string,
  offset: number,
): { line: number; column: number } {
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

/**
 * Build a project-wide styling usage report for color utilities
 * (text-*, bg-*, border-*, ring-*, fill, stroke, gradients, …)
 * with HTML/JSX tag attribution for drift analysis.
 */
export async function buildStyleUsageReport(
  options: StyleReportOptions,
): Promise<StyleUsageReport> {
  const cwd = options.cwd ?? process.cwd();
  const maxSamples = options.maxSamplesPerUtility ?? 8;
  const rel = options.relativePaths !== false;

  type Acc = {
    utility: string;
    base: string;
    propertyGroup: string;
    channel: string;
    kind: StyleUtilityKind;
    palette: string | null;
    shade: string | null;
    count: number;
    tags: Map<string, number>;
    files: Map<string, number>;
    samples: StyleHitSample[];
  };

  const byUtility = new Map<string, Acc>();
  let filesAnalyzed = 0;

  for (const file of options.files) {
    let source: string;
    try {
      source = await readFile(file, "utf8");
    } catch {
      continue;
    }
    filesAnalyzed++;
    const relFile = rel ? path.relative(cwd, file) || file : file;
    const componentHint = guessComponentName(file, source);
    const { occurrences } = extractClassOccurrences(source, {
      filePath: file,
    });

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
        // Look back for the opening tag that owns this class (prefer nearest).
        const nearby = source.slice(
          Math.max(0, offset - 240),
          Math.min(source.length, offset + 80),
        );
        const structural = extractStructuralHints(nearby);
        const tag = structural.elementName ?? null;

        const palette = parseColorUtility(token);
        const kind = classifyKind(
          classified.base,
          classified.propertyGroup,
          palette,
        );
        const channel = channelFromGroup(
          classified.propertyGroup,
          classified.base,
        );

        // Aggregate key: full token (variants matter for drift)
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
      count: a.count,
      tags: Object.fromEntries(
        [...a.tags.entries()].sort((x, y) => y[1] - x[1]),
      ),
      files: Object.fromEntries(
        [...a.files.entries()].sort((x, y) => y[1] - x[1]),
      ),
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

      // Mix of palette + semantic on same tag for text/bg/border
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

      // Many different palette families on one tag
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
        utilities: Object.fromEntries(
          [...t.utilities.entries()].sort((a, b) => b[1] - a[1]),
        ),
        groups: Object.fromEntries(
          [...t.groups.entries()].map(([g, set]) => [g, [...set].sort()]),
        ),
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
  for (const [channel, bases] of channelBases) {
    if (bases.size >= 15) {
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

  const byChannel: Record<string, number> = {};
  const byKind: Record<StyleUtilityKind, number> = {
    palette: 0,
    semantic: 0,
    arbitrary: 0,
    other: 0,
  };
  let totalHits = 0;
  const uniqueBases = new Set<string>();
  for (const u of utilities) {
    totalHits += u.count;
    uniqueBases.add(u.base);
    byChannel[u.channel] = (byChannel[u.channel] ?? 0) + u.count;
    byKind[u.kind] = (byKind[u.kind] ?? 0) + u.count;
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    cwd,
    filesAnalyzed,
    scope: "colors",
    summary: {
      totalHits,
      uniqueUtilities: utilities.length,
      uniqueBases: uniqueBases.size,
      uniqueTags: byTag.length,
      byChannel,
      byKind,
      topUtilities: utilities.slice(0, 25).map((u) => ({
        utility: u.utility,
        count: u.count,
      })),
      topTags: byTag.slice(0, 25).map((t) => ({
        tag: t.tag,
        count: t.count,
      })),
      driftCount: drift.length,
    },
    utilities,
    byTag,
    drift: drift.sort((a, b) => {
      const sev = (s: StyleDriftSignal["severity"]) => (s === "warn" ? 0 : 1);
      return sev(a.severity) - sev(b.severity);
    }),
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
  const lines: string[] = [
    `# Style usage report`,
    ``,
    `Generated: ${report.generatedAt}`,
    `Files: ${report.filesAnalyzed} · Hits: ${report.summary.totalHits} · Unique utilities: ${report.summary.uniqueUtilities}`,
    ``,
    `## Top utilities`,
    ``,
    `| Utility | Count |`,
    `|---------|------:|`,
  ];
  for (const u of report.summary.topUtilities.slice(0, 20)) {
    lines.push(`| \`${u.utility}\` | ${u.count} |`);
  }
  lines.push(``, `## Top tags`, ``, `| Tag | Color hits |`, `|-----|----------:|`);
  for (const t of report.summary.topTags.slice(0, 15)) {
    lines.push(`| \`<${t.tag}>\` | ${t.count} |`);
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
