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
tailwind-canonicalize — semantic canonicalizer & design-token migrator for Tailwind CSS

Usage:
  tailwind-canonicalize [paths...] [options]
  tailwind-canonicalize tokens analyze [paths...] [--out manifest.json]
  tailwind-canonicalize tokens apply <manifest.json> [paths...] [--write]

Core options:
  --write              Write changes to files
  --check              Exit 1 if changes would be made (CI)
  --stdin              Read source from stdin, write to stdout
  --json               Machine-readable summary
  --verbose            Print categorized rewrite details
  --diff               Print line diffs for changes
  --safe               Only exact/safe transforms (default)
  --review             Propose/report only; never write
  --aggressive         Allow review-level migrations / high-confidence inference

Migrations:
  --migrate            Apply versioned Tailwind class migrations
  --migrations-only    Only run migrations (skip arbitrary canonicalization)
  --from-tailwind <n>  Source major version (e.g. 3)
  --to-tailwind <n>    Target major version (e.g. 4)

Performance:
  --watch              Watch mode (implies --incremental)
  --incremental        Skip unchanged files via content hash cache
  --no-incremental     Force full scan
  --workers            Force worker_threads pool
  --no-workers         Disable worker pool
  --concurrency <n>    Parallel workers (default: 8)
  --cache-file <path>  Incremental cache path

Compile verification:
  --strict-compile     Only rewrite when Tailwind compile CSS matches (needs tailwindcss)
  --compile-css <file> CSS entry for compiler (default: @import "tailwindcss")

Other:
  --cwd <dir>          Working directory
  --root-font-size <n> px per rem (default: 16)
  --ignore <name>      Extra ignore name (repeatable)
  -h, --help           Show help
  -v, --version        Show version

Exit codes:
  0  success
  1  changes required (--check)
  2  error

Examples:
  tailwind-canonicalize . --write --safe
  tailwind-canonicalize . --migrate --from-tailwind 3 --to-tailwind 4
  tailwind-canonicalize . --watch --write
  tailwind-canonicalize . --incremental --workers --concurrency 16
  tailwind-canonicalize . --strict-compile --write
  tailwind-canonicalize tokens analyze src --out tailwind-tokens.json
  tailwind-canonicalize tokens apply tailwind-tokens.json --write
`.trim();
