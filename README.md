# tailwind-canonicalize

current version: `0.2.0`
[![npm](https://img.shields.io/npm/v/tailwind-canonicalize.svg)](https://www.npmjs.com/package/tailwind-canonicalize)
[![license](https://img.shields.io/npm/l/tailwind-canonicalize.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/tailwind-canonicalize.svg)](https://www.npmjs.com/package/tailwind-canonicalize)

**Semantic canonicalizer** for Tailwind CSS utility classes.

> **Docs:** [https://tailwind-canonicalize.xbp.app](https://tailwind-canonicalize.xbp.app)  
> **npm:** [tailwind-canonicalize](https://www.npmjs.com/package/tailwind-canonicalize) · **current:** `0.1.3`

Not a linter. Not a general formatter. A zero-false-positive rewriter that turns arbitrary values into theme tokens **only when the resulting utility is provably equivalent**.

```tsx
// before
<div className="w-[40px] min-w-[10rem] h-[10px] p-[16px] gap-[8px]" />

// after
<div className="w-10 min-w-40 h-2.5 p-4 gap-2" />
```

---

## Links

| | |
|--|--|
| **Homepage / docs** | [https://tailwind-canonicalize.xbp.app](https://tailwind-canonicalize.xbp.app) |
| **npm package** | [npmjs.com/package/tailwind-canonicalize](https://www.npmjs.com/package/tailwind-canonicalize) |
| **Repository** | [github.com/xylex-group/tailwind-canonicalize](https://github.com/xylex-group/tailwind-canonicalize) |
| **Issues** | [GitHub Issues](https://github.com/xylex-group/tailwind-canonicalize/issues) |

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
# or
yarn add -D tailwind-canonicalize
```

Node **20+**. ESM only.

```bash
npx tailwind-canonicalize --help
```

---

## Quick start

```bash
# scan (report)
tailwind-canonicalize .

# write changes (safe mode — exact only)
tailwind-canonicalize . --write --safe

# CI gate
tailwind-canonicalize . --check
```

More CLI examples, migrations, tokens, and performance flags:  
[CLI guide](https://tailwind-canonicalize.xbp.app/docs/cli) · [Installation](https://tailwind-canonicalize.xbp.app/docs/installation)

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
- Incompatible units (`w-[10vh]`)
- Ambiguous multi-matches (safety)
- Non-exact color matches

Full transformation tables: [docs](https://tailwind-canonicalize.xbp.app/docs).

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
canonicalizeClass("w-[140px]"); // "w-35" (continuous --spacing multiplier)
findCanonicalEquivalent("w-[10vh]"); // null

const summary = await canonicalizeProject({
  paths: ["src"],
  write: true,
});
```

API reference: [https://tailwind-canonicalize.xbp.app/docs/api](https://tailwind-canonicalize.xbp.app/docs/api)

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

| Package | Role |
|---------|------|
| **`tailwind-canonicalize`** | CLI + library API (**single published npm package**) |

Internal monorepo packages (not published; bundled into the CLI package):

| Package | Role |
|---------|------|
| `@tailwind-canonicalize/parser` | AST extraction (oxc) |
| `@tailwind-canonicalize/resolver` | Theme, migrations, pipeline, dedupe |
| `@tailwind-canonicalize/tokens` | Semantic token analyze/apply/registry |
| `@tailwind-canonicalize/transformer` | MagicString rewrites |
| `@tailwind-canonicalize/compiler` | Public orchestration API + config |
| `packages/vscode` | Editor diagnostics + Quick Fix |

---

## Integrations

`tailwind-canonicalize` is **standalone** and sits beside formatters and linters — it does not replace them.

| Tool | Docs |
|------|------|
| **Biome / Ultracite** | [Integrations](https://tailwind-canonicalize.xbp.app/docs/integrations) |
| **ESLint** | same |
| **Oxlint** | same |
| **Prettier** | same |
| **CI / hooks** | [CI](https://tailwind-canonicalize.xbp.app/docs) |

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

Details: [Safety](https://tailwind-canonicalize.xbp.app/docs/safety)

---

## Documentation

**Site:** [https://tailwind-canonicalize.xbp.app](https://tailwind-canonicalize.xbp.app)

Also in-repo (source of truth for the docs app):

- [docs site content](./apps/docs/docs/)
- [architecture notes](./docs/architecture/overview.md)
- [CLI](./docs/guides/cli.md) · [integrations](./docs/guides/integrations.md) · [API](./docs/api/reference.md)

---

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm benchmark

# Docs site
pnpm docs:dev
pnpm docs:build
pnpm docs:deploy
```

---

## License

MIT © [XYLEX Group](https://github.com/xylex-group)
