import type {
  ClassStringDiagnostic,
  TransformationRecord,
} from "@tailwind-canonicalize/resolver";
import type { ProjectSummary } from "@tailwind-canonicalize/compiler";

/** ANSI helpers — no deps; respects NO_COLOR / FORCE_COLOR / non-TTY. */
function useColor(stream: NodeJS.WriteStream = process.stderr): boolean {
  if (process.env.NO_COLOR != null && process.env.NO_COLOR !== "") {
    return false;
  }
  if (process.env.FORCE_COLOR === "0") {
    return false;
  }
  if (process.env.FORCE_COLOR != null && process.env.FORCE_COLOR !== "") {
    return true;
  }
  return Boolean(stream.isTTY);
}

type Paint = (s: string) => string;

function makePaint(enabled: boolean) {
  const wrap =
    (open: string, close = "\u001b[0m"): Paint =>
    (s) =>
      enabled ? `${open}${s}${close}` : s;

  return {
    reset: wrap("\u001b[0m"),
    bold: wrap("\u001b[1m"),
    dim: wrap("\u001b[2m"),
    red: wrap("\u001b[31m"),
    green: wrap("\u001b[32m"),
    yellow: wrap("\u001b[33m"),
    blue: wrap("\u001b[34m"),
    magenta: wrap("\u001b[35m"),
    cyan: wrap("\u001b[36m"),
    gray: wrap("\u001b[90m"),
    white: wrap("\u001b[37m"),
  };
}

export type ThemeBanner = {
  source?: ProjectSummary["themeSource"];
  /** Relative path when known (optional). */
  path?: string | null;
};

export type ReportOptions = {
  cwd: string;
  verbose?: boolean;
  /** Cap of transformation blocks in non-verbose mode (0 = hide). Default 0. */
  sampleTransformations?: number;
  /** When true, dump every diagnostic message (verbose). */
  listAllDiagnostics?: boolean;
  /** Max grouped diagnostic lines when summarizing. Default 12. */
  diagnosticGroups?: number;
  /** Optional theme CSS / config path for the banner. */
  path?: string | null;
  color?: boolean;
  stream?: NodeJS.WriteStream;
};

const THEME_LABEL: Record<NonNullable<ProjectSummary["themeSource"]>, string> = {
  css: "@theme",
  "v3-config": "tailwind.config",
  default: "defaults",
  provided: "provided",
};

/**
 * Pretty project run report (stderr).
 */
export function printProjectReport(
  summary: ProjectSummary,
  options: ReportOptions,
): void {
  const stream = options.stream ?? process.stderr;
  const color = options.color ?? useColor(stream);
  const c = makePaint(color);
  const write = (line = "") => {
    stream.write(`${line}\n`);
  };

  // ── Theme ──────────────────────────────────────────────
  if (summary.themeSource) {
    const label = THEME_LABEL[summary.themeSource] ?? summary.themeSource;
    const where = options.path ? ` from ${c.cyan(options.path)}` : "";
    write(
      `${c.cyan("●")} ${c.dim("Loaded theme")}${where} ${c.dim(`(${label})`)}`,
    );
  }

  // ── Transformations ────────────────────────────────────
  const records = collectTransformations(summary);
  const sampleN = options.verbose
    ? records.length
    : (options.sampleTransformations ?? 0);

  if (sampleN > 0 && records.length > 0) {
    write(c.dim("│"));
    const shown = records.slice(0, sampleN);
    for (const { rel, t } of shown) {
      write(formatTransformationBlock(rel, t, c));
      write(c.dim("│"));
    }
    if (records.length > sampleN) {
      write(
        `  ${c.dim(`… and ${formatNum(records.length - sampleN)} more rewrites (use --verbose)`)}`,
      );
      write(c.dim("│"));
    }
  }

  // ── Diagnostics ────────────────────────────────────────
  const diags = summary.diagnostics ?? [];
  if (diags.length > 0) {
    if (options.verbose || options.listAllDiagnostics) {
      write(c.dim("│"));
      for (const d of diags) {
        write(formatDiagnosticLine(d, c));
      }
      write(c.dim("│"));
    } else {
      write(c.dim("│"));
      write(formatDiagnosticSummary(diags, c, options.diagnosticGroups ?? 12));
      write(c.dim("│"));
    }
  }

  // ── Summary ────────────────────────────────────────────
  if (summary.errors > 0) {
    write(`${c.red("✗")} ${c.bold(String(summary.errors))} ${c.red("error(s)")}`);
  }

  write(`${c.green("✓")} ${c.bold(formatNum(summary.files))} ${c.dim("files")}`);
  if (summary.filesSkipped > 0) {
    write(
      `${c.green("✓")} ${c.bold(formatNum(summary.filesSkipped))} ${c.dim("skipped (cache)")}`,
    );
  }
  if (summary.filesChanged > 0) {
    write(
      `${c.green("✓")} ${c.bold(formatNum(summary.filesChanged))} ${c.dim("files changed")}`,
    );
  }
  write(
    `${c.green("✓")} ${c.bold(formatNum(summary.rewrites))} ${c.dim("replacements")}`,
  );

  const conflicts = summary.conflicts ?? 0;
  if (conflicts > 0) {
    write(
      `${c.yellow("!")} ${c.bold(formatNum(conflicts))} ${c.dim("conflicts detected (not rewritten)")}`,
    );
  }

  const parseErrors = summary.parseErrors ?? 0;
  if (parseErrors > 0) {
    write(
      `${c.yellow("!")} ${c.bold(formatNum(parseErrors))} ${c.dim("parse errors (files left untouched)")}`,
    );
  }

  // Only print unsafe when non-zero — "0 unsafe" was misleading next to conflicts
  if (summary.unsafe > 0) {
    write(
      `${c.yellow("!")} ${c.bold(formatNum(summary.unsafe))} ${c.dim("non-safe rewrites applied")}`,
    );
  }

  const cats = summary.transformationsByCategory ?? {};
  const catEntries = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  if (catEntries.length > 0) {
    for (const [cat, n] of catEntries) {
      write(`  ${c.dim("·")} ${c.cyan(cat)}${c.dim(`: ${formatNum(n)}`)}`);
    }
  }

  const elapsed = (summary.elapsedMs / 1000).toFixed(2);
  write(`${c.dim("Completed in")} ${c.bold(`${elapsed}s`)}`);
}

export function formatTransformationBlock(
  file: string,
  t: TransformationRecord,
  c = makePaint(useColor()),
): string {
  const loc = t.line != null ? `${file}:${t.line}` : file;
  const lines: string[] = [`  ${c.bold(loc)}`];

  if (t.replacement) {
    lines.push(`  ${c.red("−")} ${c.red(t.original)}`);
    lines.push(`  ${c.green("+")} ${c.green(t.replacement)}`);
  } else {
    lines.push(`  ${c.red("−")} ${c.red(t.original)} ${c.dim("(remove)")}`);
  }

  const safetyLabel =
    t.confidence === "exact" ? "exact" : (t.confidence ?? t.safety);
  const meta: string[] = [
    `category: ${t.category}`,
    `safety: ${safetyLabel}`,
  ];
  if (t.token) {
    meta.push(`token: ${t.token}`);
  }
  lines.push(`    ${c.dim(meta.join(" · "))}`);

  return lines.join("\n");
}

/** Single-line transformation (legacy-friendly). */
export function formatTransformation(
  t: TransformationRecord,
  file?: string,
  color = useColor(),
): string {
  const c = makePaint(color);
  const rel = file ?? t.file ?? "";
  return formatTransformationBlock(rel, t, c);
}

function formatDiagnosticLine(
  d: ClassStringDiagnostic,
  c: ReturnType<typeof makePaint>,
): string {
  const icon =
    d.kind === "conflict"
      ? c.yellow("!")
      : d.kind === "duplicate-candidate"
        ? c.cyan("·")
        : c.dim("i");
  return `  ${icon} ${d.message}`;
}

/**
 * Collapse flood of identical conflict messages into counts + top pairs.
 */
export function formatDiagnosticSummary(
  diags: ClassStringDiagnostic[],
  c = makePaint(useColor()),
  maxGroups = 12,
): string {
  const conflicts = diags.filter((d) => d.kind === "conflict");
  const other = diags.filter((d) => d.kind !== "conflict");

  const lines: string[] = [];
  lines.push(
    `  ${c.yellow("!")} ${c.bold(formatNum(diags.length))} ${c.dim("diagnostics")}${
      conflicts.length
        ? c.dim(` · ${formatNum(conflicts.length)} conflicts`)
        : ""
    }`,
  );

  // Group conflicts by property group when message matches known shape
  type Group = {
    label: string;
    count: number;
    pairs: Map<string, number>;
  };
  const groups = new Map<string, Group>();

  for (const d of conflicts) {
    const parsed = parseConflictMessage(d.message, d.utilities);
    const key = parsed.group;
    let g = groups.get(key);
    if (!g) {
      g = { label: key, count: 0, pairs: new Map() };
      groups.set(key, g);
    }
    g.count++;
    if (parsed.pair) {
      g.pairs.set(parsed.pair, (g.pairs.get(parsed.pair) ?? 0) + 1);
    }
  }

  const sorted = [...groups.values()].sort((a, b) => b.count - a.count);
  const shown = sorted.slice(0, maxGroups);
  for (const g of shown) {
    const topPairs = [...g.pairs.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([pair, n]) =>
        n > 1 ? `${pair} ${c.dim(`×${n}`)}` : pair,
      )
      .join(c.dim(", "));
    const pairBit = topPairs ? c.dim("  ") + topPairs : "";
    lines.push(
      `  ${c.dim("·")} ${c.yellow(g.label)} ${c.bold(String(g.count))}${pairBit}`,
    );
  }
  if (sorted.length > maxGroups) {
    lines.push(
      `  ${c.dim(`· … ${sorted.length - maxGroups} more conflict groups`)}`,
    );
  }

  if (other.length > 0) {
    const byKind = new Map<string, number>();
    for (const d of other) {
      byKind.set(d.kind, (byKind.get(d.kind) ?? 0) + 1);
    }
    for (const [kind, n] of byKind) {
      lines.push(`  ${c.dim("·")} ${kind} ${c.bold(String(n))}`);
    }
  }

  lines.push(
    `  ${c.dim("(no automatic resolution · use --verbose for full list)")}`,
  );

  return lines.join("\n");
}

function parseConflictMessage(
  message: string,
  utilities: string[],
): { group: string; pair: string | null } {
  // "Conflicting border-color-or-width utilities: border and border-border. ..."
  const m = message.match(
    /^Conflicting\s+(.+?)\s+utilities:\s+(\S+)\s+and\s+(\S+)/i,
  );
  if (m) {
    return {
      group: m[1]!,
      pair: `${m[2]} ↔ ${m[3]}`,
    };
  }
  if (utilities.length >= 2) {
    return {
      group: "conflict",
      pair: `${utilities[0]} ↔ ${utilities[1]}`,
    };
  }
  return { group: "conflict", pair: null };
}

function collectTransformations(
  summary: ProjectSummary,
): Array<{ rel: string; t: TransformationRecord }> {
  const out: Array<{ rel: string; t: TransformationRecord }> = [];
  for (const file of summary.results) {
    if (!file.transformations?.length) {
      continue;
    }
    const rel = file.filePath;
    for (const t of file.transformations) {
      out.push({ rel: t.file ?? rel, t });
    }
  }
  return out;
}

export function formatNum(n: number): string {
  return n.toLocaleString("en-US");
}

export function printError(message: string, stream = process.stderr): void {
  const c = makePaint(useColor(stream));
  stream.write(`${c.red("✗")} ${c.bold("error:")} ${message}\n`);
}

export function printThemeBanner(
  themeSource: ProjectSummary["themeSource"],
  path: string | null | undefined,
  stream = process.stderr,
): void {
  if (!themeSource) {
    return;
  }
  const c = makePaint(useColor(stream));
  const label = THEME_LABEL[themeSource] ?? themeSource;
  const where = path ? ` from ${c.cyan(path)}` : "";
  stream.write(
    `${c.cyan("●")} ${c.dim("Loaded theme")}${where} ${c.dim(`(${label})`)}\n`,
  );
}
