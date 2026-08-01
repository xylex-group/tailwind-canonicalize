# Integrations overview

`tailwind-canonicalize` is **standalone**. It does not require Biome, ESLint, Oxlint, or Prettier. It is built so those tools remain first-class in your repo while canonicalize owns **one job**: prove and rewrite Tailwind utilities.

## What it is / is not

| It is | It is not |
|-------|-----------|
| Semantic rewrites of Tailwind classes | A general JS/TS formatter |
| A CI gate (`--check`) | A style-guide linter |
| Compatible with any formatter | A replacement for Biome/ESLint/Oxlint |
| Idempotent under re-run | An opinionated class sorter (optional future) |

## Why “first-class” support matters

Most Tailwind tooling either:

- **lints** class order / conflicts (ESLint plugins), or  
- **formats** whitespace around attributes (Biome/Prettier), or  
- **generates** CSS from classes (Tailwind itself).

None of those safely turn `w-[40px]` into `w-10` using your theme. Canonicalize fills that gap **without** taking over lint/format ownership.

## Recommended architecture

```text
┌─────────────────────────────────────────────────────────┐
│  Editor / Git hook / CI                                 │
└───────────────────────────┬─────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
 tailwind-canonicalize   Biome / Ultracite   ESLint or Oxlint
   (semantic classes)     (format + lint)     (lint rules)
        │                   │                   │
        └───────────────────┴───────────────────┘
                            ▼
                      Typecheck / Test
```

### Ownership boundaries

| Concern | Owner |
|---------|--------|
| Quote style, semicolons, import order | Biome / Prettier / ESLint |
| Unused vars, a11y, React hooks | Biome / ESLint / Oxlint |
| `w-[40px]` → `w-10`, migrations, tokens | **tailwind-canonicalize** |
| Tailwind CSS generation | Tailwind CLI / Vite plugin |

Do **not** enable ESLint rules that rewrite arbitrary values to scale keys if you also run canonicalize — they will fight or double-apply. Prefer one owner for semantic rewrites.

## Package scripts (template)

```json
{
  "scripts": {
    "canonicalize": "tailwind-canonicalize . --write --safe",
    "canonicalize:check": "tailwind-canonicalize . --check --json",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "check": "pnpm canonicalize:check && pnpm lint && pnpm typecheck",
    "fix": "pnpm canonicalize && pnpm lint:fix"
  }
}
```

Swap `biome` for `ultracite`, `eslint`, or `oxlint` as needed — see dedicated guides.

## lint-staged (all ecosystems)

```json
{
  "*.{js,jsx,ts,tsx,mjs,cjs,vue,astro,svelte,html,mdx}": [
    "tailwind-canonicalize --write",
    "biome check --write --no-errors-on-unmatched"
  ]
}
```

Notes:

- Pass **file paths** (lint-staged does); canonicalize accepts path args.
- Put canonicalize **before** Biome/ESLint fix so format runs on already-canonical classes.
- For ESLint-only: replace the Biome line with `eslint --fix`.
- For Oxlint: Oxlint typically does not rewrite; keep canonicalize as the rewrite step.

### Husky

`.husky/pre-commit`:

```sh
#!/usr/bin/env sh
pnpm exec lint-staged
```

### Lefthook

```yaml
# lefthook.yml
pre-commit:
  commands:
    canonicalize:
      glob: "*.{js,jsx,ts,tsx,vue,astro,html,mdx}"
      run: pnpm exec tailwind-canonicalize {staged_files} --write
    biome:
      glob: "*.{js,jsx,ts,tsx,json,jsonc}"
      run: pnpm exec biome check --write --no-errors-on-unmatched {staged_files}
```

## Monorepos (pnpm / Turborepo / Nx)

### pnpm filter

```bash
pnpm --filter web exec tailwind-canonicalize src --check
```

### Turborepo

```json
{
  "tasks": {
    "canonicalize": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint": {
      "dependsOn": ["canonicalize"]
    }
  }
}
```

```json
// apps/web/package.json
{
  "scripts": {
    "canonicalize": "tailwind-canonicalize src --write --safe",
    "canonicalize:check": "tailwind-canonicalize src --check",
    "lint": "biome check ."
  }
}
```

### Nx

```json
{
  "targets": {
    "canonicalize": {
      "command": "tailwind-canonicalize src --check",
      "options": { "cwd": "{projectRoot}" }
    }
  }
}
```

## CI composition

Run canonicalize as its **own job or step**, not inside the linter binary:

```yaml
- name: Canonicalize (Tailwind)
  run: pnpm canonicalize:check

- name: Lint (Biome)
  run: pnpm lint

- name: Lint (Oxlint)   # optional second linter
  run: pnpm oxlint
```

Exit codes: canonicalize `1` = changes required (same idea as `prettier --check` / `biome ci`).

## Configuration coexistence

| Config file | Purpose |
|-------------|---------|
| `tailwind-canonicalize.config.ts` | Canonicalize modes, migrations, tokens |
| `biome.json(c)` | Format + lint |
| `eslint.config.js` | ESLint rules |
| `.oxlintrc.json` / `oxlint` CLI | Oxlint rules |
| `.prettierrc` | Prettier only if not using Biome format |
| `.lintstagedrc` | Hook orchestration |

Canonicalize never reads Biome/ESLint configs. Integration is **orchestration**, not coupling.

## stdin for editor formatters

Some editor pipelines pipe buffer text:

```bash
tailwind-canonicalize --stdin < %file%
```

Stdout is the rewritten source. Exit `0` even when changed (unless `--check`). Combine with Biome’s range formatting carefully — prefer **file-path** mode on save.

## Conflict matrix (avoid these)

| Anti-pattern | Why |
|--------------|-----|
| Two tools rewrite the same class strings | Non-deterministic diffs |
| Running Prettier *class sorting* that reorders after token apply | Noise; use one orderer if any |
| Treating canonicalize as `eslint --fix` for style | Wrong abstraction; CI will surprise you |
| Regex codemods for `w-[40px]` outside this tool | Unsafe / no theme proof |

## Next

- [Biome + Ultracite](./biome.md)
- [ESLint](./eslint.md)
- [Oxlint](./oxlint.md)
- [Prettier](./prettier.md)
- [CI](./ci.md)
