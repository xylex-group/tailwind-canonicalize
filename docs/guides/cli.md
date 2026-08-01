# CLI usage

```bash
tailwind-canonicalize [paths...] [options]
```

## Flags

| Flag | Description |
|------|-------------|
| `--write` | Write rewrites to disk |
| `--check` | Fail if any rewrite would apply |
| `--stdin` | Read source from stdin, write to stdout |
| `--json` | Print summary JSON |
| `--verbose` | Per-rewrite logging |
| `--diff` | Print line diffs |
| `--cwd <dir>` | Working directory |
| `--concurrency <n>` | Parallelism |
| `--root-font-size <n>` | px per rem |
| `--ignore <name>` | Extra ignore (repeatable) |
| `-h, --help` | Help |
| `-v, --version` | Version |

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
