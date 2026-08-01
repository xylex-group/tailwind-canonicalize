# Documentation

`tailwind-canonicalize` is a **semantic canonicalizer** for Tailwind CSS utilities — not a linter and not a general formatter. It is designed to sit **alongside** Biome, ESLint, Oxlint, Prettier, Ultracite, and CI tools without fighting them.

## Guides

| Guide | Description |
|-------|-------------|
| [CLI](./guides/cli.md) | Commands, flags, exit codes |
| [Integrations overview](./guides/integrations.md) | How to combine with lint/format tooling |
| [Biome](./guides/biome.md) | Biome + Ultracite (first-class) |
| [ESLint](./guides/eslint.md) | ESLint flat config, eslint-plugin wrappers |
| [Oxlint](./guides/oxlint.md) | Oxlint pipelines |
| [Prettier](./guides/prettier.md) | Ordering with Prettier |
| [Editors](./guides/editors.md) | VS Code and format-on-save |
| [CI](./guides/ci.md) | GitHub Actions, pre-commit, monorepos |
| [Migrations](./guides/migrations.md) | Tailwind v3 → v4 class renames |
| [Tokens](./guides/tokens.md) | Semantic design-token analyze/apply |
| [Performance](./guides/performance.md) | Incremental, workers, watch |
| [Benchmarks](./guides/benchmarks.md) | Methodology |
| [Contributing](./guides/contributing.md) | Dev setup |
| [Roadmap](./guides/roadmap.md) | Future work |

## Architecture

| Doc | Description |
|-----|-------------|
| [Overview](./architecture/overview.md) | Package layers |
| [Algorithm](./architecture/algorithm.md) | Equivalence rules |
| [Safety](./architecture/safety.md) | Zero unsafe rewrites |
| [Transformations](./architecture/transformations.md) | Categories and pipeline |

## API

| Doc | Description |
|-----|-------------|
| [Reference](./api/reference.md) | Public library API |

## Design principle vs other tools

| Tool | Role | Overlap with tailwind-canonicalize? |
|------|------|-------------------------------------|
| **Biome** | Lint + format | Complementary — run after or before; different concerns |
| **Ultracite** | Biome preset / DX | Complementary — scripts wire both |
| **ESLint** | Lint (rules, plugins) | Complementary — optional thin plugin to call `--check` |
| **Oxlint** | Fast lint | Complementary — separate step in CI/hooks |
| **Prettier** | Opinionated format | Complementary — never rewrites class *semantics* |
| **tailwind-canonicalize** | Semantic class rewrite | Unique — only tool that rewrites utilities by theme proof |

**Recommended pipeline order (hooks / CI):**

```text
1. tailwind-canonicalize --write   # semantic (class contents)
2. biome check --write / ultracite fix   # format + lint autofix
   OR eslint --fix / oxlint
3. typecheck / tests
```

Or reverse step 1 and 2 if you prefer format-first; both are stable when canonicalize is **idempotent** and formatters do not invent arbitrary values.
