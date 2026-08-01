# Agent notes — tailwind-canonicalize

## Lint / format

Biome is configured at the repo root (`biome.jsonc`). This project **documents** first-class composition with Biome, ESLint, Oxlint, and Prettier — canonicalize never replaces those tools.

```bash
pnpm check   # biome / ultracite when wired
pnpm fix
pnpm test
pnpm build
```

Consumer integration docs: `docs/guides/integrations.md`, `docs/guides/biome.md`, `docs/guides/eslint.md`, `docs/guides/oxlint.md`.

## Non-negotiables

1. **Zero unsafe rewrites** — never guess theme matches.
2. **TypeScript strict + ESM only** — no plain JS sources.
3. **Real AST extraction** for JS/TS — do not regex whole files for classes.
4. **Preserve formatting** via MagicString.
5. Packages stay layered: parser → resolver → transformer → compiler → cli.
6. **Do not** implement Biome/ESLint “style” ownership inside this tool — integrate via CLI steps.

## Working on rewrites

Touch `packages/resolver` first. Add tests before expanding coverage.

## Working on docs

Integration guides live under `docs/guides/`. Keep ownership boundaries explicit: semantic rewrites here; format/lint elsewhere.
