import type { PipelineMode } from "@tailwind-canonicalize/resolver";
import { makePaint, type PaintKit, useColor } from "./ansi.js";

export type CliCommand = "run" | "tokens-analyze" | "tokens-apply" | "tokens-report";

export interface CliArgs {
  command: CliCommand;
  paths: string[];
  write: boolean;
  check: boolean;
  stdin: boolean;
  json: boolean;
  verbose: boolean;
  diff: boolean;
  help: boolean;
  version: boolean;
  cwd: string;
  concurrency: number;
  rootFontSizePx: number;
  ignore: string[];
  migrate: boolean;
  migrationsOnly: boolean;
  fromTailwind?: number;
  toTailwind?: number;
  mode: PipelineMode;
  safe: boolean;
  review: boolean;
  aggressive: boolean;
  manifestPath?: string;
  outManifest?: string;
  watch: boolean;
  incremental: boolean;
  workers: boolean | "auto";
  strictCompile: boolean;
  compileCss?: string;
  cacheFile?: string;
  /**
   * Write the human-readable report (rewrites + diagnostics + summary) to a file.
   * Plain text (no ANSI). Does not replace stderr output.
   */
  reportPath?: string;
  /**
   * Optional markdown companion for `tokens report` (style usage).
   */
  styleReportMarkdown?: string;
}

/** True when a token looks like a CLI flag, not a path/value. */
export function looksLikeFlag(token: string): boolean {
  if (token === "-" || token === "--") {
    return true;
  }
  // Paths like ./-file or /tmp/-x are values; dash-leading flags are not.
  if (token.startsWith("./") || token.startsWith(".\\")) {
    return false;
  }
  if (token.startsWith("/") || /^[A-Za-z]:[\\/]/.test(token)) {
    return false;
  }
  return token.startsWith("-");
}

/**
 * Read the next argv token as a required option value.
 * Rejects missing values and flag-like tokens so `--report -h` cannot
 * silently write a file named "-h".
 */
export function requireOptionValue(
  flag: string,
  argv: string[],
  index: number,
  exampleValue = "value",
): { value: string; nextIndex: number } {
  const next = argv[index + 1];
  if (next == null || next === "") {
    throw new Error(
      `Option ${flag} requires a value (got end of arguments). Example: ${flag} ${exampleValue}`,
    );
  }
  if (looksLikeFlag(next)) {
    const helpHint =
      next === "-h" || next === "--help"
        ? " — put -h/--help on its own, not after a flag that takes a value."
        : "";
    throw new Error(
      `Option ${flag} requires a value (got ${JSON.stringify(next)}). Example: ${flag} ${exampleValue}${helpHint}`,
    );
  }
  return { value: next, nextIndex: index + 1 };
}

function requireEqualsValue(flag: string, raw: string, exampleValue: string): string {
  if (raw === "") {
    throw new Error(
      `Option ${flag} requires a value (got empty). Example: ${flag}=${exampleValue}`,
    );
  }
  return raw;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    command: "run",
    paths: [],
    write: false,
    check: false,
    stdin: false,
    json: false,
    verbose: false,
    diff: false,
    help: false,
    version: false,
    cwd: process.cwd(),
    concurrency: 8,
    rootFontSizePx: 16,
    ignore: [],
    migrate: false,
    migrationsOnly: false,
    mode: "safe",
    safe: false,
    review: false,
    aggressive: false,
    watch: false,
    incremental: false,
    workers: "auto",
    strictCompile: false,
  };

  let i = 0;

  if (argv[0] === "tokens") {
    if (argv[1] === "analyze") {
      args.command = "tokens-analyze";
      i = 2;
    } else if (argv[1] === "apply") {
      args.command = "tokens-apply";
      i = 2;
      if (argv[i] && !argv[i]!.startsWith("-")) {
        args.manifestPath = argv[i];
        i++;
      }
    } else if (argv[1] === "report") {
      args.command = "tokens-report";
      i = 2;
    } else {
      throw new Error("Usage: tailwind-canonicalize tokens <analyze|apply|report> ...");
    }
  }

  for (; i < argv.length; i++) {
    const a = argv[i]!;

    // --flag=value forms
    if (a.startsWith("--report=")) {
      args.reportPath = requireEqualsValue("--report", a.slice("--report=".length), "report.txt");
      continue;
    }
    if (a.startsWith("--md=") || a.startsWith("--markdown=")) {
      const raw = a.startsWith("--md=") ? a.slice("--md=".length) : a.slice("--markdown=".length);
      args.styleReportMarkdown = requireEqualsValue("--md", raw, "styles.md");
      continue;
    }
    if (a.startsWith("-o=") && a.length > 3) {
      args.reportPath = requireEqualsValue("-o", a.slice(3), "report.txt");
      continue;
    }
    if (a.startsWith("--cwd=")) {
      args.cwd = requireEqualsValue("--cwd", a.slice("--cwd=".length), ".");
      continue;
    }
    if (a.startsWith("--concurrency=")) {
      args.concurrency = Number(
        requireEqualsValue("--concurrency", a.slice("--concurrency=".length), "8"),
      );
      continue;
    }
    if (a.startsWith("--root-font-size=")) {
      args.rootFontSizePx = Number(
        requireEqualsValue("--root-font-size", a.slice("--root-font-size=".length), "16"),
      );
      continue;
    }
    if (a.startsWith("--ignore=")) {
      args.ignore.push(requireEqualsValue("--ignore", a.slice("--ignore=".length), "dist"));
      continue;
    }
    if (a.startsWith("--from-tailwind=")) {
      args.fromTailwind = Number(
        requireEqualsValue("--from-tailwind", a.slice("--from-tailwind=".length), "3"),
      );
      args.migrate = true;
      continue;
    }
    if (a.startsWith("--to-tailwind=")) {
      args.toTailwind = Number(
        requireEqualsValue("--to-tailwind", a.slice("--to-tailwind=".length), "4"),
      );
      args.migrate = true;
      continue;
    }
    if (a.startsWith("--compile-css=")) {
      args.compileCss = requireEqualsValue(
        "--compile-css",
        a.slice("--compile-css=".length),
        "app.css",
      );
      continue;
    }
    if (a.startsWith("--cache-file=")) {
      args.cacheFile = requireEqualsValue(
        "--cache-file",
        a.slice("--cache-file=".length),
        ".cache.json",
      );
      continue;
    }
    if (a.startsWith("--out=")) {
      args.outManifest = requireEqualsValue("--out", a.slice("--out=".length), "manifest.json");
      if (args.command === "tokens-apply" && !args.manifestPath) {
        args.manifestPath = args.outManifest;
      }
      continue;
    }
    if (a.startsWith("--manifest=")) {
      args.outManifest = requireEqualsValue(
        "--manifest",
        a.slice("--manifest=".length),
        "manifest.json",
      );
      if (args.command === "tokens-apply" && !args.manifestPath) {
        args.manifestPath = args.outManifest;
      }
      continue;
    }

    switch (a) {
      case "-h":
      case "--help":
        args.help = true;
        break;
      case "-v":
      case "--version":
        args.version = true;
        break;
      case "-w":
      case "--write":
        args.write = true;
        break;
      case "--check":
        args.check = true;
        break;
      case "--stdin":
        args.stdin = true;
        break;
      case "--json":
        args.json = true;
        break;
      case "--verbose":
        args.verbose = true;
        break;
      case "--diff":
        args.diff = true;
        break;
      case "--cwd": {
        const r = requireOptionValue("--cwd", argv, i, ".");
        args.cwd = r.value;
        i = r.nextIndex;
        break;
      }
      case "--concurrency": {
        const r = requireOptionValue("--concurrency", argv, i, "8");
        args.concurrency = Number(r.value);
        i = r.nextIndex;
        break;
      }
      case "--root-font-size": {
        const r = requireOptionValue("--root-font-size", argv, i, "16");
        args.rootFontSizePx = Number(r.value);
        i = r.nextIndex;
        break;
      }
      case "--ignore": {
        const r = requireOptionValue("--ignore", argv, i, "dist");
        args.ignore.push(r.value);
        i = r.nextIndex;
        break;
      }
      case "--migrate":
        args.migrate = true;
        break;
      case "--migrations-only":
        args.migrationsOnly = true;
        args.migrate = true;
        break;
      case "--from-tailwind": {
        const r = requireOptionValue("--from-tailwind", argv, i, "3");
        args.fromTailwind = Number(r.value);
        args.migrate = true;
        i = r.nextIndex;
        break;
      }
      case "--to-tailwind": {
        const r = requireOptionValue("--to-tailwind", argv, i, "4");
        args.toTailwind = Number(r.value);
        args.migrate = true;
        i = r.nextIndex;
        break;
      }
      case "--safe":
        args.safe = true;
        args.mode = "safe";
        break;
      case "--review":
        args.review = true;
        args.mode = "review";
        break;
      case "--aggressive":
        args.aggressive = true;
        args.mode = "aggressive";
        break;
      case "--watch":
        args.watch = true;
        args.incremental = true;
        break;
      case "--incremental":
        args.incremental = true;
        break;
      case "--no-incremental":
        args.incremental = false;
        break;
      case "--workers":
        args.workers = true;
        break;
      case "--no-workers":
        args.workers = false;
        break;
      case "--strict-compile":
        args.strictCompile = true;
        break;
      case "--compile-css": {
        const r = requireOptionValue("--compile-css", argv, i, "app.css");
        args.compileCss = r.value;
        i = r.nextIndex;
        break;
      }
      case "--cache-file": {
        const r = requireOptionValue("--cache-file", argv, i, ".cache.json");
        args.cacheFile = r.value;
        i = r.nextIndex;
        break;
      }
      case "--report":
      case "-o": {
        const r = requireOptionValue(a, argv, i, "report.txt");
        args.reportPath = r.value;
        i = r.nextIndex;
        break;
      }
      case "--md":
      case "--markdown": {
        const r = requireOptionValue(a, argv, i, "styles.md");
        args.styleReportMarkdown = r.value;
        i = r.nextIndex;
        break;
      }
      case "--out":
      case "--manifest": {
        const r = requireOptionValue(a, argv, i, "manifest.json");
        args.outManifest = r.value;
        if (args.command === "tokens-apply" && !args.manifestPath) {
          args.manifestPath = args.outManifest;
        }
        i = r.nextIndex;
        break;
      }
      default:
        if (a.startsWith("-")) {
          throw new Error(`Unknown option: ${a}`);
        }
        args.paths.push(a);
    }
  }

  if (args.paths.length === 0 && !args.stdin && !args.help && !args.version) {
    args.paths = ["."];
  }

  if (args.write && args.check) {
    throw new Error("Cannot use --write and --check together");
  }

  if (args.safe && args.aggressive) {
    throw new Error("Cannot use --safe and --aggressive together");
  }

  if (args.review) {
    args.write = false;
  }

  return args;
}

/** Plain-text help (stable for tests / programmatic consumers). */
export const HELP = `
tailwind-canonicalize — rewrite Tailwind utilities only when provably identical

USAGE
  tailwind-canonicalize [paths...] [options]
  tailwind-canonicalize tokens analyze [paths...] [--out manifest.json]
  tailwind-canonicalize tokens apply <manifest.json> [paths...] [--write]
  tailwind-canonicalize tokens report [paths...] [--out styles-report.json] [--md styles.md]

  Paths default to "." when omitted. Source is rewritten in place only with
  --write (never with --check or --review).

MODES (pick one; default is safe)
  --safe               Exact / high-confidence rewrites only (default)
  --review             Report proposed rewrites; never write files
  --aggressive         Also allow review-level migrations & inferred tokens

WRITE / CI
  -w, --write          Apply rewrites to files on disk
  --check              Exit 1 if any rewrite would apply (CI gate; no write)
  --stdin              Read one source unit from stdin; write result to stdout

REPORTING
  --verbose            Full −/+ rewrite blocks + every diagnostic line
  --diff               Unified-style line diffs for changed files
  --json               Machine-readable summary on stdout (no pretty report)
  -o, --report <file>  Also write the human report to <file> (plain text,
                       no ANSI). Requires a path (e.g. --report report.txt
                       or --report=report.txt). Do not put -h after --report.
                       Useful for CI artifacts and review threads.
                       Does not suppress stderr output.

  Conflicts (same cascade slot, different values) are never auto-resolved.
  They are listed under diagnostics and left untouched in source.

MIGRATIONS (Tailwind major bumps)
  --migrate            Enable versioned class migrations
  --migrations-only    Migrations only (skip arbitrary → named rewrites)
  --from-tailwind <n>  Source major (e.g. 3)
  --to-tailwind <n>    Target major (e.g. 4)

PERFORMANCE
  --watch              Watch paths (implies --incremental)
  --incremental        Skip unchanged files via content-hash cache
  --no-incremental     Force a full scan
  --workers            Force worker_threads pool
  --no-workers         Disable worker pool (single-threaded)
  --concurrency <n>    Parallel workers (default: 8)
  --cache-file <path>  Incremental cache file path

COMPILE VERIFICATION (optional, needs peer tailwindcss)
  --strict-compile     Only rewrite when compiled CSS matches
  --compile-css <file> CSS entry for the compiler
                       (default: @import "tailwindcss")

TOKENS SUBCOMMANDS
  tokens analyze [paths...] [--out manifest.json]
      Scan palette usage; write a proposal manifest (review before apply).
  tokens apply <manifest.json> [paths...] [--write]
      Apply approved token mappings from a manifest.
  tokens report [paths...] [-o|--out report.json] [--md report.md]
      Export a styling usage report: color utility frequencies (text-black,
      bg-slate-200, border-*, ring-*, fill, gradients, semantic tokens, …)
      with HTML/JSX tag attribution and drift signals. Never rewrites source.

OTHER
  --cwd <dir>          Working directory (default: process cwd)
  --root-font-size <n> px per rem for length math (default: 16)
  --ignore <name>      Extra ignore path segment (repeatable)
  -h, --help           Show this help
  -v, --version        Print version

EXIT CODES
  0  success (no pending changes, or write succeeded)
  1  changes required under --check / --review
  2  hard error (bad flags, parse/IO failure, alias cycles, …)

EXAMPLES
  # Preview safe rewrites in CI (fail if dirty)
  tailwind-canonicalize . --check --safe

  # Apply exact arbitrary → named rewrites
  tailwind-canonicalize . --write --safe

  # Full report to a file (e.g. for PR review)
  tailwind-canonicalize . --check --aggressive --verbose -o canonicalize-report.txt

  # Tailwind v3 → v4 class migrations
  tailwind-canonicalize . --migrate --from-tailwind 3 --to-tailwind 4 --write

  # Watch + write while editing
  tailwind-canonicalize src --watch --write

  # Design-token flow
  tailwind-canonicalize tokens analyze . --out tailwind-tokens.json
  tailwind-canonicalize tokens analyze app components --out tailwind-tokens.json
  tailwind-canonicalize tokens apply tailwind-tokens.json --write

  # Style usage / drift report (colors + tags)
  tailwind-canonicalize tokens report . -o styles-report.json --md styles.md

  # Machine output for scripts
  tailwind-canonicalize . --check --json

NOTES
  · Conflicts such as two different max-w-* values are reported, not rewritten.
  · False “conflicts” between unrelated properties (e.g. font-mono + font-medium)
    are filtered by property-group identity — if you still see one, file an issue.
  · Value flags (--report, --cwd, …) reject the next token if it looks like a
    flag: use --report report.txt, not --report -h.
  · Compose with Biome / ESLint / Prettier / Oxlint for formatting & lint;
    this tool only owns semantic class rewrites.
  · NO_COLOR=1 disables ANSI; FORCE_COLOR=1 forces it.
`.trim();

const SECTION =
  /^(USAGE|MODES.*|WRITE \/ CI|REPORTING|MIGRATIONS.*|PERFORMANCE|COMPILE VERIFICATION.*|TOKENS SUBCOMMANDS|OTHER|EXIT CODES|EXAMPLES|NOTES)$/;

/**
 * Colorized help for terminals (stdout). Plain when `color === false` or
 * when NO_COLOR / non-TTY applies (default auto-detect on stdout).
 */
export function formatHelp(color: boolean = useColor(process.stdout)): string {
  if (!color) {
    return HELP;
  }
  const c = makePaint(true);
  return HELP.split("\n")
    .map((line) => paintHelpLine(line, c))
    .join("\n");
}

function paintHelpLine(line: string, c: PaintKit): string {
  if (!line) {
    return line;
  }

  // Title
  if (line.startsWith("tailwind-canonicalize —")) {
    const [name, ...rest] = line.split(" — ");
    return `${c.bold(c.cyan(name ?? "tailwind-canonicalize"))}${c.dim(" — ")}${c.dim(rest.join(" — "))}`;
  }

  // Section headers
  if (SECTION.test(line)) {
    return c.bold(c.yellow(line));
  }

  // Comments in EXAMPLES
  if (/^\s*#/.test(line)) {
    return c.dim(line);
  }

  // Example commands (indented, not a flag row)
  if (/^\s{2}tailwind-canonicalize\b/.test(line) && !/^\s{2}-/.test(line)) {
    return c.green(line);
  }

  // Flag rows: "  --flag …" or "  -w, --write …"
  const flagRow = line.match(/^(\s+)(-[^\s].*?)(\s{2,})(.*)$/);
  if (flagRow) {
    const [, indent, flags, gap, desc] = flagRow;
    return `${indent}${paintFlags(flags!, c)}${gap}${desc}`;
  }

  // Indented subcommand rows under TOKENS
  const sub = line.match(/^(\s{4,})(tokens\s+\S+(?:\s+.*)?)$/);
  if (sub) {
    return `${sub[1]}${c.cyan(sub[2]!)}`;
  }

  // Exit codes: "  0  success…"
  const exit = line.match(/^(\s+)(\d)(\s{2,})(.*)$/);
  if (exit) {
    return `${exit[1]}${c.bold(exit[2]!)}${exit[3]}${exit[4]}`;
  }

  // Notes bullets
  if (/^\s+·/.test(line)) {
    return c.dim(line);
  }

  // Soften secondary prose under USAGE
  if (/^\s{2}Paths default/.test(line) || /^\s{2}--write \(never/.test(line)) {
    return c.dim(line);
  }
  if (/^\s{2}Conflicts \(same cascade/.test(line) || /^\s{2}They are listed/.test(line)) {
    return c.dim(line);
  }
  if (/^\s{2}Does not suppress/.test(line) || /^\s{2}no ANSI\)/.test(line)) {
    return c.dim(line);
  }
  if (/^\s{23}/.test(line) && !line.trimStart().startsWith("-")) {
    // continuation of multi-line flag description
    return c.dim(line);
  }

  return line;
}

/** Highlight flag tokens inside a flags column (e.g. `-w, --write`). */
function paintFlags(flags: string, c: PaintKit): string {
  return flags.replace(/(-{1,2}[a-zA-Z][\w-]*)/g, (m) => c.cyan(m));
}
