# CLI usage

```bash
tailwind-canonicalize [paths...] [options]
```

## Flags

| Flag | Description |
|------|-------------|
| `--write` / `-w` | Write rewrites to disk |
| `--check` | Fail if any rewrite would apply |
| `--stdin` | Read source from stdin, write to stdout |
| `--json` | Print summary JSON |
| `--verbose` | Per-rewrite −/+ blocks and full diagnostic list |
| `--diff` | Print line diffs |
| `-o, --report <file>` | Also write the human report (plain text) to a file. Requires a path (`--report report.txt`); do not put `-h` after `--report` |
| `--safe` / `--review` / `--aggressive` | Pipeline mode (default: safe) |
| `--cwd <dir>` | Working directory |
| `--concurrency <n>` | Parallelism |
| `--root-font-size <n>` | px per rem |
| `--ignore <name>` | Extra ignore (repeatable) |
| `-h, --help` | Help |
| `-v, --version` | Version |

## Output

Default human output (stderr) is colorized when the terminal supports it (`NO_COLOR` disables; `FORCE_COLOR` forces):

- Theme banner (`● Loaded theme from …`)
- Grouped conflict diagnostics (full list with `--verbose`)
- Tree-style rewrites with `--verbose` / a short sample under `--check` / `--review`
- Summary counts and category breakdown

`--help` (stdout) is also ANSI-colored on a TTY: bold yellow section headers, cyan flags, green examples. Same `NO_COLOR` / `FORCE_COLOR` rules apply (detected on **stdout** for help).

Use `-o report.txt` (or `--report report.txt`) to persist the same plain-text report for CI artifacts or PR threads. With `--json`, the file receives pretty-printed JSON instead.

### Conflicts

Same cascade slot, different values → diagnostic only (never rewritten). Property-group identity filters false positives, e.g.:

| Classes | Conflict? |
|---------|-----------|
| `prose` + `prose-sm` | No (enable + size) |
| `before:from-50%` + `before:from-popover` | No (position + color) |
| `flex` + `grid` | Yes (display) |

## JSON shape

```json
{
  "files": 1523,
  "filesChanged": 412,
  "rewrites": 9421,
  "unsafe": 0,
  "errors": 0,
  "elapsedMs": 1821
}
```

## Supported extensions

`ts`, `tsx`, `js`, `jsx`, `mjs`, `cjs`, `mts`, `cts`, `html`, `vue`, `astro`, `svelte`, `mdx`

## With linters / formatters

Canonicalize is not a replacement for Biome, ESLint, Oxlint, or Prettier. Compose:

```bash
tailwind-canonicalize . --write --safe
biome check --write .    # or: eslint --fix / prettier --write
tailwind-canonicalize . --check   # CI
```

Full guides: [integrations](./integrations.md) · [biome](./biome.md) · [eslint](./eslint.md) · [oxlint](./oxlint.md)
