# Contributing

## Setup

```bash
pnpm install
pnpm build
pnpm test
```

## Layout

```
packages/parser|resolver|transformer|compiler|cli|vscode|tokens
tests/ fixtures/ benchmarks/ docs/ action/
```

## Documentation

- Index: `docs/README.md`
- Integration guides (Biome, ESLint, Oxlint, Prettier): `docs/guides/integrations.md` and siblings
- When adding a CLI flag or pipeline category, update the relevant guide and the README integrations table if user-facing

## Adding a rewrite rule

1. Add a failing unit test under `packages/resolver`.
2. Implement the minimal theme/namespace/keyword change.
3. Add a fixture under `fixtures/` when the case is extraction-related.
4. Document the rule if it is user-visible.

## Safety bar

Any PR that rewrites a case without an exact theme match will be rejected.

## Commits & releases

Governing decision: [ADR 0001](../adr/0001-workspace-release-ownership.md). Live inventory: [debt inventory](../architecture/debt.md).

Changesets is the only npm version authority. Use:

```bash
pnpm changeset
```

CI publishes from `main` via `changesets/action` (`pnpm release`). XBP keeps the releases ledger and docs Cloudflare worker orchestration; it does not publish to npm.

Root `package.json#packageManager` (`pnpm@9.15.0`) is the only Node pin. CI invokes `pnpm check`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.

## Workspace classes

The same nine `pnpm-workspace.yaml` members. Exactly one class each:

| Member | Class |
|--------|--------|
| `@tailwind-canonicalize/{parser,resolver,transformer,compiler,tokens}` | internal (`private`, no npm publish) |
| `tailwind-canonicalize` (`packages/cli`) | publishable (sole Changesets npm package) |
| `tailwind-canonicalize-vscode` | integration |
| `docs` | app |
| `tailwind-canonicalize-action` | tooling (composite `action.yml` only) |

Knip ignores `packages/vscode/**` and `action/**` because those classes are not Node library graphs, not because they are outside the workspace.

## Compatibility-only until 2026-10-01

These paths stay until **2026-10-01**. They are not a second publishable package or a second membership list. Tracked as [AD-001](../architecture/debt.md#ad-001)–[AD-003](../architecture/debt.md#ad-003):

- CLI dual surface: `bin` plus `exports` under the npm name `tailwind-canonicalize`
- `packages/cli/tsup.config.ts` bundles `../compiler/src/worker.ts` from source (`noExternal` workspace packages)
- `vitest.config.ts` source aliases to `packages/*/src` instead of `dist`
