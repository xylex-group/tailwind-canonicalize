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

Use Changesets:

```bash
pnpm changeset
```

CI publishes from `main` via `changesets/action`.
