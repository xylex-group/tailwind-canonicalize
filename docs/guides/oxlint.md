# Oxlint integration (first-class)

[Oxlint](https://oxc.rs/docs/guide/usage/linter.html) is a high-performance linter from the Oxc project. It is excellent for **fast lint** feedback; it does not perform theme-aware Tailwind canonicalization.

`tailwind-canonicalize` pairs with Oxlint the same way it pairs with ESLint: **separate steps**, clear ownership.

## Install

```bash
pnpm add -D tailwind-canonicalize oxlint
```

## Scripts

```json
{
  "scripts": {
    "canonicalize": "tailwind-canonicalize . --write --safe",
    "canonicalize:check": "tailwind-canonicalize . --check",
    "lint": "oxlint .",
    "fix": "pnpm canonicalize",
    "check": "pnpm canonicalize:check && pnpm lint"
  }
}
```

Oxlint is primarily a **reporter** (limited autofix surface compared to ESLint). Keep semantic rewrites on the canonicalize CLI.

## Recommended pipeline

```text
1. tailwind-canonicalize --write / --check
2. oxlint .
3. tsc --noEmit
```

### CI

```yaml
- name: Tailwind canonicalize
  run: pnpm exec tailwind-canonicalize . --check --json

- name: Oxlint
  run: pnpm exec oxlint .
```

## lint-staged

```json
{
  "*.{js,jsx,ts,tsx,mjs,cjs}": [
    "tailwind-canonicalize --write",
    "oxlint"
  ]
}
```

## Monorepo

Oxlint is often used for **speed on large trees**. Canonicalize supports the same scale:

```bash
# CI job A — fast lint
pnpm exec oxlint apps packages

# CI job B — semantic gate (can use workers)
pnpm exec tailwind-canonicalize apps packages --check --workers --incremental
```

Run them in **parallel** jobs if desired — they do not share lock state. For pre-commit, still run canonicalize first when you want staged rewrites, then oxlint on the result.

## Config coexistence

Example `.oxlintrc.json` (illustrative):

```json
{
  "rules": {
    "correctness/noUnusedVariables": "warn"
  },
  "ignorePatterns": [
    "dist",
    "node_modules",
    ".tailwind-canonicalize-cache.json"
  ]
}
```

No Oxlint rule is required for Tailwind arbitrary values. If a community rule appears for class sorting, treat it as **ordering only**.

## Oxlint + Biome / ESLint

| Combo | Pattern |
|-------|---------|
| Oxlint + Biome | Oxlint (fast correctness), Biome (format), canonicalize (Tailwind semantics) |
| Oxlint + ESLint | Oxlint in pre-commit; ESLint type-aware in CI; canonicalize always separate |
| Oxlint only | `canonicalize` + `oxlint` + `tsc` is a lean stack |

Example scripts for Oxlint + Biome:

```json
{
  "scripts": {
    "fix": "tailwind-canonicalize . --write --safe && biome check --write .",
    "lint": "oxlint . && biome check .",
    "check": "tailwind-canonicalize . --check && oxlint . && biome ci ."
  }
}
```

## Why not fold into Oxlint?

Oxlint rules are optimized for **static correctness** and speed. Theme loading, migration registries, token manifests, and dual-theme pair proofs are a **compiler-shaped** pipeline. First-class support means:

1. Documented, copy-paste pipelines  
2. Shared exit-code conventions with other check tools  
3. No fighting over who rewrites `className` strings  

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Oxlint CI green, production has arbitraries | Add `canonicalize --check` to CI |
| Pre-commit too slow | `--incremental` is for full runs; for staged files pass only staged paths |
| Double noise on class strings | Ensure only canonicalize rewrites utilities |

## See also

- [Integrations overview](./integrations.md)
- [Biome](./biome.md)
- [ESLint](./eslint.md)
- [Performance](./performance.md)
