import type { PipelineMode } from "@tailwind-canonicalize/resolver";

export type CliCommand = "run" | "tokens-analyze" | "tokens-apply";

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
    } else {
      throw new Error("Usage: tailwind-canonicalize tokens <analyze|apply> ...");
    }
  }

  for (; i < argv.length; i++) {
    const a = argv[i]!;
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
      case "--cwd":
        args.cwd = argv[++i] ?? args.cwd;
        break;
      case "--concurrency":
        args.concurrency = Number(argv[++i] ?? 8);
        break;
      case "--root-font-size":
        args.rootFontSizePx = Number(argv[++i] ?? 16);
        break;
      case "--ignore":
        args.ignore.push(argv[++i] ?? "");
        break;
      case "--migrate":
        args.migrate = true;
        break;
      case "--migrations-only":
        args.migrationsOnly = true;
        args.migrate = true;
        break;
      case "--from-tailwind":
        args.fromTailwind = Number(argv[++i]);
        args.migrate = true;
        break;
      case "--to-tailwind":
        args.toTailwind = Number(argv[++i]);
        args.migrate = true;
        break;
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
      case "--compile-css":
        args.compileCss = argv[++i];
        break;
      case "--cache-file":
        args.cacheFile = argv[++i];
        break;
      case "--report":
      case "-o":
        args.reportPath = argv[++i];
        break;
      case "--out":
      case "--manifest":
        args.outManifest = argv[++i];
        if (args.command === "tokens-apply" && !args.manifestPath) {
          args.manifestPath = args.outManifest;
        }
        break;
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

export const HELP = `
tailwind-canonicalize — rewrite Tailwind utilities only when provably identical

USAGE
  tailwind-canonicalize [paths...] [options]
  tailwind-canonicalize tokens analyze [paths...] [--out manifest.json]
  tailwind-canonicalize tokens apply <manifest.json> [paths...] [--write]

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
                       no ANSI). Useful for CI artifacts and review threads.
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

  # Machine output for scripts
  tailwind-canonicalize . --check --json

NOTES
  · Conflicts such as two different max-w-* values are reported, not rewritten.
  · False “conflicts” between unrelated properties (e.g. font-mono + font-medium)
    are filtered by property-group identity — if you still see one, file an issue.
  · Compose with Biome / ESLint / Prettier / Oxlint for formatting & lint;
    this tool only owns semantic class rewrites.
  · NO_COLOR=1 disables ANSI; FORCE_COLOR=1 forces it.
`.trim();
