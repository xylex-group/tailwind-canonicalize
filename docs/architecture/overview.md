# Architecture overview

`tailwind-canonicalize` is a layered pipeline. Each layer is an independent package with its own unit tests.

```
┌─────────────────────────────────────────────────────────────┐
│ CLI / VS Code / GitHub Action (npm: tailwind-canonicalize)  │
└────────────────────────────┬────────────────────────────────┘
                             │
                     compiler (orchestrator)
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
      parser            resolver           transformer
   (oxc AST +            (theme +           (MagicString
    HTML extract)         equivalence)        rewrite)
```

## Packages

### `@tailwind-canonicalize/parser`

- Parses JS/TS/JSX/TSX with **oxc** (real AST, not whole-file regex).
- Walks `className` / `class`, `clsx`, `cn`, `cva`, `twMerge`, `classnames`, `tw\`\``, nested arrays/objects/conditionals.
- Extracts HTML `class` attributes and SFC regions (Vue/Svelte/Astro).

### `@tailwind-canonicalize/resolver`

- Loads default Tailwind v4 theme tokens and merges project `@theme` CSS.
- Parses utility structure (variants, important, negative, arbitrary).
- Generates candidate scale keys and compares **normalized CSS values**.
- Returns a match only when exactly one safe candidate remains.

### `@tailwind-canonicalize/transformer`

- Applies resolver results with **MagicString**.
- Preserves surrounding formatting, comments, and non-class code.
- Optional high-resolution sourcemaps.

### `@tailwind-canonicalize/compiler`

- In-repo orchestration: `canonicalizeClass`, `canonicalizeClasses`, `canonicalizeFile`, `canonicalizeProject`, `findCanonicalEquivalent`.
- File scanning, parallel workers, project theme discovery.
- **internal** class: private workspace package; consumers import the published `tailwind-canonicalize` CLI package, not this name.

### `tailwind-canonicalize` (CLI)

- **publishable** class: sole npm package and sole Changesets non-ignored member.
- Flags: `--write`, `--check`, `--stdin`, `--json`, `--verbose`, `--diff`.
- Exit codes: 0 / 1 / 2.

## Workspace ownership

Canonical owner: root [`package.json`](../../package.json). Membership list: [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml). Version authority: Changesets. XBP is ledger + docs worker only.

| Member | Class |
|--------|--------|
| `@tailwind-canonicalize/{parser,resolver,transformer,compiler,tokens}` | internal |
| `tailwind-canonicalize` | publishable |
| `tailwind-canonicalize-vscode` | integration |
| `docs` | app |
| `tailwind-canonicalize-action` | tooling (composite `action.yml`) |

See [ADR 0001](../adr/0001-workspace-release-ownership.md) and [debt inventory](./debt.md). Compatibility aliases (CLI dual surface, tsup worker, vitest source aliases) sunset **2026-10-01**.

## Design principles

1. **Zero false positives** over recall.
2. **Theme-driven** — never hardcode project tokens.
3. **Format-preserving** rewrites.
4. **Composable layers** — each package usable alone.
5. **Deterministic** — same input + theme ⇒ same output.
6. **Standalone but ecosystem-friendly** — first-class docs and exit codes for Biome, ESLint, Oxlint, Prettier, and CI; no takeover of format/lint ownership.

See [Integrations](../guides/integrations.md).
