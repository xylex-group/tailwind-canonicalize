# CI integration

Canonicalize is a **check tool** with Prettier/Biome-style exit codes. Run it as its own step beside Biome, ESLint, or Oxlint — never as a hidden side effect of lint.

This repository’s own CI ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)) uses root [`package.json#packageManager`](../../package.json) (`pnpm@9.15.0`) and invokes `pnpm check`, `pnpm typecheck`, `pnpm test`, and `pnpm build`. It does not pin a competing pnpm major. Publish on `main` is Changesets (`changesets/action` → `pnpm release`). Consumer examples below may pin pnpm for *their* repos.

## Exit codes

| Code | Meaning | Typical CI |
|------|---------|------------|
| `0` | Clean | Pass |
| `1` | Changes required (`--check`) | Fail PR |
| `2` | Error (IO, config, cycles) | Fail PR |

## GitHub Actions (recommended)

### Minimal

```yaml
name: canonicalize
on: [pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - run: pnpm exec tailwind-canonicalize . --check --json
```

### Full quality gate (Biome + canonicalize)

```yaml
name: quality
on:
  pull_request:
  push:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install

      - name: Tailwind canonicalize
        run: pnpm exec tailwind-canonicalize . --check --json --safe

      - name: Biome
        run: pnpm exec biome ci .

      - name: Typecheck
        run: pnpm typecheck

      - name: Test
        run: pnpm test
```

### ESLint + Oxlint matrix

```yaml
      - name: Tailwind canonicalize
        run: pnpm exec tailwind-canonicalize src --check --workers

      - name: Oxlint
        run: pnpm exec oxlint .

      - name: ESLint
        run: pnpm exec eslint .
```

### Migrations gate (optional separate job)

```yaml
  migrate-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # ... setup ...
      - name: No deprecated Tailwind v3 classes
        run: pnpm exec tailwind-canonicalize . --migrations-only --check --from-tailwind 3 --to-tailwind 4
```

## Composite action

```yaml
- uses: tailwind-canonicalize/action@v1
  with:
    path: src
```

## Pre-commit

Prefer **lint-staged** (see [integrations](./integrations.md), [biome](./biome.md)):

```sh
#!/usr/bin/env sh
pnpm exec lint-staged
```

Full-tree on commit is slower; staged paths are enough for day-to-day, with `--check` on the whole tree in CI.

## Monorepo CI (pnpm)

```yaml
- run: pnpm --filter "./apps/*" --filter "./packages/*" exec tailwind-canonicalize . --check
```

Or from root with path args:

```bash
pnpm exec tailwind-canonicalize apps packages --check --workers --concurrency 16
```

## Caching in CI

- **Do not** cache `.tailwind-canonicalize-cache.json` across PRs if theme/config changes often — false skips.
- Safe: use `--incremental` only on self-hosted runners with warm workspaces, or local watch mode.
- CI default: full `--check` without incremental for correctness.

## Failure UX

```bash
# Developers reproduce CI
pnpm exec tailwind-canonicalize . --check --verbose --diff
# Apply
pnpm exec tailwind-canonicalize . --write --safe
```

## See also

- [Integrations overview](./integrations.md)
- [Biome](./biome.md)
- [ESLint](./eslint.md)
- [Oxlint](./oxlint.md)
