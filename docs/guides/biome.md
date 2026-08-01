# Biome integration (first-class)

[Biome](https://biomejs.dev/) owns **format + lint**.  
`tailwind-canonicalize` owns **semantic Tailwind class rewrites**.

They compose cleanly because Biome does not prove theme equivalence for arbitrary values, and canonicalize does not reformat TypeScript style.

## Ultracite

[Ultracite](https://www.ultracite.com/) is a Biome-first preset used in many monorepos. Treat Ultracite as the Biome operator; wire canonicalize beside it.

```json
{
  "scripts": {
    "canonicalize": "tailwind-canonicalize . --write --safe",
    "canonicalize:check": "tailwind-canonicalize . --check",
    "lint": "ultracite check",
    "fix": "tailwind-canonicalize . --write --safe && ultracite fix",
    "check": "tailwind-canonicalize . --check && ultracite check"
  }
}
```

## Install

```bash
pnpm add -D tailwind-canonicalize @biomejs/biome
# or with Ultracite
pnpm add -D tailwind-canonicalize ultracite @biomejs/biome
```

## Recommended order

### Local fix

```bash
pnpm exec tailwind-canonicalize . --write --safe
pnpm exec biome check --write .
# or
pnpm exec ultracite fix
```

### CI

```bash
pnpm exec tailwind-canonicalize . --check
pnpm exec biome ci .
# or
pnpm exec ultracite check
```

`biome ci` is read-only like `--check`; keep canonicalize as a **separate** step so failures are attributed correctly.

## package.json template

```json
{
  "scripts": {
    "canonicalize": "tailwind-canonicalize . --write --safe",
    "canonicalize:check": "tailwind-canonicalize . --check --json",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "fix": "pnpm canonicalize && pnpm lint:fix",
    "check": "pnpm canonicalize:check && pnpm lint && pnpm typecheck"
  }
}
```

## lint-staged + Biome

`.lintstagedrc.json`:

```json
{
  "*.{js,jsx,ts,tsx,mjs,cjs,json,jsonc,css}": [
    "biome check --write --no-errors-on-unmatched"
  ],
  "*.{js,jsx,ts,tsx,mjs,cjs,vue,astro,svelte,html,mdx}": [
    "tailwind-canonicalize --write"
  ]
}
```

If both globs match the same file, lint-staged may run both. Prefer a **single entry** with ordered commands:

```json
{
  "*.{js,jsx,ts,tsx,mjs,cjs,vue,astro,html,mdx}": [
    "tailwind-canonicalize --write",
    "biome check --write --no-errors-on-unmatched"
  ],
  "*.{json,jsonc,css}": [
    "biome check --write --no-errors-on-unmatched"
  ]
}
```

## biome.jsonc notes

No Biome configuration is required for canonicalize. Suggested ignores so Biome does not waste work on generated theme CSS if you emit tokens:

```jsonc
{
  "files": {
    "includes": [
      "**",
      "!**/node_modules",
      "!**/dist",
      "!**/.tailwind-canonicalize-cache.json"
    ]
  }
}
```

If you generate `semantic-theme.css` via `tokens apply`, either format it with Biome CSS support or exclude it if machine-generated.

## VS Code

With Biome as default formatter:

```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports.biome": "explicit",
    "source.fixAll.biome": "explicit"
  }
}
```

Run **Tailwind Canonicalize: Document** (extension) or a save task **before** format if you want semantic rewrites on save:

`.vscode/tasks.json` (optional):

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "tailwind-canonicalize file",
      "type": "shell",
      "command": "pnpm exec tailwind-canonicalize ${file} --write --safe",
      "problemMatcher": []
    }
  ]
}
```

Or use the VS Code extension’s Quick Fix for single classes (diagnostics).

## Turborepo task graph

```json
{
  "tasks": {
    "canonicalize": {
      "cache": false
    },
    "lint": {
      "dependsOn": ["canonicalize"]
    }
  }
}
```

Set `"cache": false` on canonicalize if outputs are in-place source edits (Turbo cache of lint inputs stays correct when canonicalize runs first in CI without relying on remote cache of rewritten sources).

## GitHub Actions

```yaml
- name: Tailwind canonicalize
  run: pnpm exec tailwind-canonicalize . --check --json

- name: Biome
  run: pnpm exec biome ci .
```

## Why not a Biome plugin?

Biome plugins (e.g. Grit) are excellent for **pattern** transforms, but theme-aware equivalence needs:

- project `@theme` / `tailwind.config` loading  
- multi-match safety  
- migrations + token manifests  

That logic lives in this CLI/library. A future thin Biome plugin could **invoke** the same engine; until then, **compose as two steps** — that is the supported first-class integration.

## Migrations + Biome

```bash
pnpm exec tailwind-canonicalize . --migrate --from-tailwind 3 --to-tailwind 4 --write
pnpm exec biome check --write .
```

Biome may rewrap long `className` strings after renames (`bg-gradient-to-br` → `bg-linear-to-br`); that is expected and desirable.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Infinite save loop | Ensure only one tool writes on save; disable dual formatters |
| Biome changes class order only | Harmless; canonicalize is idempotent on semantics |
| `--check` fails after Biome only | Unrelated — canonicalize checks class tokens, not format |
| Cache stale after theme change | Delete `.tailwind-canonicalize-cache.json` or change options |

## See also

- [Integrations overview](./integrations.md)
- [ESLint](./eslint.md)
- [Oxlint](./oxlint.md)
