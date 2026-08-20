# Architecture debt inventory

Regenerated **20 August 2026** from the tree after consolidating `workspace-release-ownership-split`. Counts are observed, not estimated.

**Command:** `pnpm list -r --depth -1 --json`  
**Governing ADR:** [`docs/adr/0001-workspace-release-ownership.md`](../adr/0001-workspace-release-ownership.md)  
**Spec:** [`docs/sdd/workspace-release-ownership-split.md`](../sdd/workspace-release-ownership-split.md)

## Workspace members (evidence)

Nine `pnpm-workspace.yaml` members plus the private root (not a member):

| Path | `name` | `private` | Class | `publishConfig` |
| --- | --- | --- | --- | --- |
| `packages/parser` | `@tailwind-canonicalize/parser` | true | internal | none |
| `packages/resolver` | `@tailwind-canonicalize/resolver` | true | internal | none |
| `packages/transformer` | `@tailwind-canonicalize/transformer` | true | internal | none |
| `packages/tokens` | `@tailwind-canonicalize/tokens` | true | internal | none |
| `packages/compiler` | `@tailwind-canonicalize/compiler` | true | internal | none |
| `packages/cli` | `tailwind-canonicalize` | false | publishable | `access=public` |
| `packages/vscode` | `tailwind-canonicalize-vscode` | true | integration | none |
| `apps/docs` | `docs` | true | app | none |
| `action` | `tailwind-canonicalize-action` | true | tooling | none |
| *(root)* | `tailwind-canonicalize-monorepo` | true | workspace root | none |

Root `version` `0.2.0` is not advertised as npm current. npm current is `tailwind-canonicalize@0.1.19`.

## Metrics (close-law inventory)

| Metric | PRE (spec characterization) | POST (this tree) | Δ | Evidence |
| --- | ---: | ---: | ---: | --- |
| `duplicate_types` | 5 | **0** | −5 | Internals `private: true` with no `publishConfig` |
| `duplicate_helpers` | 8 | **0** | −8 | Changesets `ignore` still lists the eight non-publishable members; they no longer carry quasi-publish identity |
| `persistence_representations` | 4 | **1** | −3 | npm version store = Changesets only; XBP ledger is not a version authority |
| `projection_paths` | 11 | **0** | −11 | `.xbp/xbp.toml` has zero `[[services]]` |
| `public_symbols` | 0 | **0** | 0 | No new public npm name |
| `root_test_binaries` | 0 | **0** | 0 | No dedicated SDD / xtask binary; pin is `tests/workspace-governance.target.test.ts` |

Expected spec reductions treated `persistence_representations` as the four competing stores collapsing. POST remaining npm version store is **1** (Changesets). Extra competing stores (XBP `version_targets` as npm, semantic-release, `[publish.npm]`) are **0**.

## Closed debt

### `workspace-release-ownership-split`

| Field | Value |
| --- | --- |
| Status | **Closed** |
| Owner | root [`package.json`](../../package.json) |
| Bounded context | `workspace-release-environment` |
| Close law | one class per member; `packageManager` only Node pin; Changesets only npm versioner; XBP ledger/workers only; CI invokes root scripts; generated outputs ignored; composite Action only |

Superseded representations (gone, not aliased):

- `.github/workflows/release.yml` (`npx semantic-release`)
- `action/src/index.ts`, `action/tsconfig.json`
- internals `publishConfig.access=public`
- `.xbp/xbp.toml` `[publish.npm]` and `[[services]]` (including `apps/docs/public`)
- tracked `apps/docs/.blume` (`**/.blume/` gitignored)

## Remaining (compatibility-only, sunset 2026-10-01)

These are **not** a second publishable package or a second membership list. After sunset: still one npm package; worker entry and test resolution must not invent a second owner.

### AD-001

Title: CLI dual bin + library surface under `tailwind-canonicalize`  
Owner: `packages/cli`  
Removal: **2026-10-01**  
Status: Open (accepted compatibility)  
Enforcement: [`docs/guides/contributing.md`](../guides/contributing.md); `packages/cli/package.json` `bin` + `exports`

### AD-002

Title: tsup bundles `compiler/src/worker.ts` from source (`noExternal` workspace packages)  
Owner: `packages/cli`  
Removal: **2026-10-01**  
Status: Open (accepted compatibility)  
Enforcement: `packages/cli/tsup.config.ts` contains `../compiler/src/worker.ts`

### AD-003

Title: Vitest source aliases to `packages/*/src` instead of `dist`  
Owner: `vitest.config.ts`  
Removal: **2026-10-01**  
Status: Open (accepted compatibility)  
Enforcement: `vitest.config.ts` `resolve.alias`

## Out of this inventory

- Historical XBP `0.2.0` ledger TOMLs — history, not npm current
- Knip ignore of `packages/vscode/**` and `action/**` — class-based (integration/tooling), documented in contributing
- `tsc -b` project refs omit vscode/docs/action — typecheck graph for internals + CLI, not a second membership list
