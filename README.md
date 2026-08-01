# tailwind-canonicalize

current version: `0.1.0`
**Semantic canonicalizer** for Tailwind CSS utility classes.

Not a linter. Not a general formatter. A zero-false-positive rewriter that turns arbitrary values into theme tokens **only when the resulting utility is provably equivalent**.

```tsx
// before
<div className="w-[40px] min-w-[10rem] h-[10px] p-[16px] gap-[8px]" />

// after
<div className="w-10 min-w-40 h-2.5 p-4 gap-2" />
```

---

## Why

Arbitrary values are useful while exploring UI. Over time they accumulate noise, fight design tokens, and make diffs harder to review. `tailwind-canonicalize` rewrites them into the project's real theme scale — never guessing, never approximating.

**Zero unsafe rewrites > coverage.**

---

## Install

```bash
pnpm add -D tailwind-canonicalize
# or
npm i -D tailwind-canonicalize
```

Node **20+**. ESM only.

---

## CLI

```bash
# scan (report)
tailwind-canonicalize .

# write changes (safe mode — exact only)
tailwind-canonicalize . --write --safe

# CI gate
tailwind-canonicalize . --check

# Tailwind v3 → v4 class migrations
tailwind-canonicalize . --migrate --from-tailwind 3 --to-tailwind 4 --write
tailwind-canonicalize . --migrations-only --write

# Semantic tokens (two-phase)
tailwind-canonicalize tokens analyze . --out tailwind-tokens.proposed.json
tailwind-canonicalize tokens apply tailwind-tokens.json --write

# machine-readable / review
tailwind-canonicalize . --json --verbose
tailwind-canonicalize . --review --diff

# performance
tailwind-canonicalize . --watch --write
tailwind-canonicalize . --incremental --workers --concurrency 16

# optional Tailwind compile verification (peer: tailwindcss)
tailwind-canonicalize . --strict-compile --write
```

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Changes required (`--check`) |
| `2` | Error |

### Example output

```
✓ 1,523 files
✓ 9,421 replacements
✓ 0 unsafe rewrites
Completed in 1.82s
```

---

## What gets rewritten

| Input | Output | Rule |
|-------|--------|------|
| `w-[40px]` | `w-10` | spacing scale (0.25rem × 10) |
| `min-w-[10rem]` | `min-w-40` | spacing scale |
| `p-[16px]` | `p-4` | spacing scale |
| `rounded-[8px]` | `rounded-lg` | radius tokens |
| `text-[16px]` | `text-base` | font size tokens |
| `w-[50%]` | `w-1/2` | fraction |
| `w-[100%]` | `w-full` | keyword |
| `h-[100vh]` | `h-screen` | keyword |
| `hover:md:w-[40px]` | `hover:md:w-10` | variants preserved |
| `w-[40px]!` | `w-10!` | important preserved |
| `-top-[20px]` / `top-[-20px]` | `-top-5` | negatives |

### Never rewritten

- Arbitrary properties: `[mask-image:…]`
- `calc()`, `var()`, `min()`, `max()`, `clamp()`
- Unknown / non-theme values (`w-[13px]`)
- Ambiguous multi-matches (safety)
- Non-exact color matches

---

## Public API

```ts
import {
  canonicalizeClass,
  canonicalizeClasses,
  canonicalizeFile,
  canonicalizeProject,
  canonicalizeSource,
  findCanonicalEquivalent,
  loadThemeFromCss,
  loadThemeFromProject,
} from "tailwind-canonicalize";

canonicalizeClass("w-[40px]"); // "w-10"
findCanonicalEquivalent("w-[13px]"); // null

const summary = await canonicalizeProject({
  paths: ["src"],
  write: true,
});
```

---

## Architecture

```
Parser  →  Extract class candidates
        →  Tailwind Resolver (theme + candidates)
        →  Normalize & compare values
        →  Choose single canonical match
        →  MagicString rewrite
        →  Print
```

Monorepo packages:

| Package | Role |
|---------|------|
| `@tailwind-canonicalize/parser` | AST extraction (oxc) |
| `@tailwind-canonicalize/resolver` | Theme, migrations, pipeline, dedupe |
| `@tailwind-canonicalize/tokens` | Semantic token analyze/apply/registry |
| `@tailwind-canonicalize/transformer` | MagicString rewrites |
| `@tailwind-canonicalize/compiler` | Public orchestration API + config |
| `tailwind-canonicalize` | CLI |
| `packages/vscode` | Editor diagnostics + Quick Fix |

See [docs/architecture](./docs/architecture/overview.md), [transformations](./docs/architecture/transformations.md), [migrations](./docs/guides/migrations.md), [tokens](./docs/guides/tokens.md).

---

## Integrations (first-class)

`tailwind-canonicalize` is **standalone** and designed to sit beside formatters and linters — it does not replace them.

| Tool | Role | Docs |
|------|------|------|
| **Biome / Ultracite** | Format + lint | [docs/guides/biome.md](./docs/guides/biome.md) |
| **ESLint** | Lint rules / optional thin plugin | [docs/guides/eslint.md](./docs/guides/eslint.md) |
| **Oxlint** | Fast lint | [docs/guides/oxlint.md](./docs/guides/oxlint.md) |
| **Prettier** | Format only | [docs/guides/prettier.md](./docs/guides/prettier.md) |
| **CI / hooks** | Gates & pre-commit | [docs/guides/ci.md](./docs/guides/ci.md) · [integrations](./docs/guides/integrations.md) |

**Recommended order:**

```bash
tailwind-canonicalize . --write --safe   # semantic class rewrites
biome check --write .                    # or ultracite fix / eslint --fix
```

### lint-staged

```json
{
  "*.{js,jsx,ts,tsx,vue,astro,html,mdx}": [
    "tailwind-canonicalize --write",
    "biome check --write --no-errors-on-unmatched"
  ]
}
```

### GitHub Action

```yaml
- uses: tailwind-canonicalize/action@v1
  with:
    path: .
```

### CI

```bash
tailwind-canonicalize . --check --json
biome ci .   # or: eslint . / oxlint .
```

---

## Theme loading

v4-first: discovers project CSS (`@import "tailwindcss"`, `@theme { … }`) and merges tokens onto defaults. Never assumes a hard-coded project theme when CSS is present.

```ts
import { loadThemeFromProject, canonicalizeClass } from "tailwind-canonicalize";

const { theme } = await loadThemeFromProject(process.cwd());
canonicalizeClass("text-[#ff0000]", { theme }); // "text-brand" if defined
```

---

## Safety contract

A rewrite is applied only when **exactly one** theme candidate matches the arbitrary value after normalization (px↔rem at configurable root font size, default 16).

Multiple matches ⇒ leave untouched.  
Zero matches ⇒ leave untouched.

---

## Documentation

Full index: **[docs/README.md](./docs/README.md)**

- [Architecture](./docs/architecture/overview.md)
- [Canonicalization algorithm](./docs/architecture/algorithm.md)
- [Safety guarantees](./docs/architecture/safety.md)
- [Transformations](./docs/architecture/transformations.md)
- [CLI usage](./docs/guides/cli.md)
- [**Integrations** (Biome, ESLint, Oxlint, Prettier)](./docs/guides/integrations.md)
- [API reference](./docs/api/reference.md)
- [Migrations](./docs/guides/migrations.md) · [Tokens](./docs/guides/tokens.md) · [Performance](./docs/guides/performance.md)
- [Editors](./docs/guides/editors.md) · [CI](./docs/guides/ci.md)
- [Contributing](./docs/guides/contributing.md) · [Roadmap](./docs/guides/roadmap.md)

---

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm benchmark

# Docs site (Blume)
pnpm docs:dev
pnpm docs:build
```

---

## License

MIT © XYLEX Group
