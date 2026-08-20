# Changesets-only npm versioning, XBP ledger/orchestration, one class per workspace member

Date: 20 August 2026  
**Status:** accepted  
Author and approver: Floris  
Canonical source: [docs/adr/0001-workspace-release-ownership.md](./0001-workspace-release-ownership.md)

**Debt:** `workspace-release-ownership-split`  
**Spec:** [`docs/sdd/workspace-release-ownership-split.md`](../sdd/workspace-release-ownership-split.md)  
**Inventory:** [`docs/architecture/debt.md`](../architecture/debt.md)

The repository already has a pnpm workspace, layered packages, Changesets, a composite GitHub Action, and an XBP ledger — but CI, XBP `[[services]]` / `[publish.npm]`, dormant semantic-release, and `private` + `publishConfig` internals each claim ownership of membership, tasks, or npm versions. We record one owner and one class law so those competitors cannot be “fixed” back in.

No prior ADR governed this bounded context. This record does not supersede another decision.

## Context

Maintainers could not answer “what is a package, who versions it, who runs tasks, and what is generated” from one owner. Root [`package.json`](../../package.json) already had `packageManager`, scripts, and Changesets entrypoints, while CI, XBP, dormant semantic-release, quasi-publishable internals, knip, tsc project refs, tracked `.blume`, and an unused Action TypeScript entry each asserted a different repository.

That split produced two “current versions” (root/XBP `0.2.0` vs npm `0.1.19`), a dispatchable second releaser, tracked generated `.blume`, and internals that looked publishable.

## Decision

1. **Canonical owner** of workspace scripts, Node execution pin, and release entrypoints is root `package.json` (`packageManager`, `scripts`, Changesets commands). [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml) enumerates members; it is not a second product.
2. **Exactly one class per pnpm-workspace member:** `internal` (`@tailwind-canonicalize/{parser,resolver,transformer,compiler,tokens}`), `publishable` (`tailwind-canonicalize` in `packages/cli`), `integration` (`tailwind-canonicalize-vscode`), `app` (`docs`), `tooling` (`tailwind-canonicalize-action`). Do not CREATE a new topology or fold layers into the CLI.
3. **Changesets is the only npm version authority.** The only non-ignored Changesets package is `tailwind-canonicalize`. Internals stay `private` without `publishConfig`. Dormant semantic-release and XBP `[publish.npm]` are not npm publishers.
4. **XBP is orchestration and ledger only** (docs Cloudflare `[[workers]]`, `.xbp/releases`, version history as evidence). It is not an npm versioner and not a k8s/pm2 service map of every directory.
5. **CI invokes root scripts** (`pnpm check`, `pnpm test`, `pnpm build`, `pnpm typecheck`) using `packageManager`; it does not pin a competing pnpm major or reconstruct biome paths.
6. **Composite `action/action.yml` is the only Action architecture.**
7. **Generated outputs** are gitignored or regenerated in CI with `git diff --exit-code`.

This applies to:

- The nine [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml) members and the private workspace root
- [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) and Changesets publish on `main`
- [`.xbp/xbp.toml`](../../.xbp/xbp.toml) workers + ledger
- [`action/action.yml`](../../action/action.yml)

## Why

The alternative (Turbo as task owner, publishing internals, or making XBP the version SSOT) would add a store instead of closing the debt.

## Considered and rejected

- **Turbo / second task graph** — forbidden; root scripts already exist.
- **Publish internals on npm** — would add public surface; CLI already bundles them for the single tarball.
- **semantic-release as primary** — already dormant beside Changesets; two npm authorities is the bug.
- **XBP `version_targets` as SSOT** — contradicts Changesets ignore and `versioning_disabled`; keep ledger only.
- **Node20 JavaScript Action** — unused `action/src` would become a second architecture; composite stays.

## Non-goals

- Folding parser → compiler into `packages/cli`
- VS Code Marketplace publish automation
- Replacing Blume or the Cloudflare docs worker
- Deleting the XBP ledger or docs `[[workers]]`
- Changing the published `tailwind-canonicalize` library API

## Consequences

- Compatibility-only until **2026-10-01**: CLI dual bin+library name, tsup bundling `compiler/src/worker.ts`, vitest source aliases. Not extra classes. Tracked as [AD-001](../architecture/debt.md#ad-001)–[AD-003](../architecture/debt.md#ad-003).
- Docs, knip, and tsc project references must follow member class, not invent a quieter membership list.
- Historical XBP release TOMLs remain ledger, not a prompt to bump npm to `0.2.0`.
- Root `package.json` `version` is not an npm current version; README/npm current equals `packages/cli` / Changesets.
- MUST: one class per member; `pnpm@9.15.0` from `packageManager` only; Changesets-only npm publish of `tailwind-canonicalize`.
- MUST NOT: restore `publishConfig` on internals, semantic-release workflows, XBP `[publish.npm]`, or directory-as-service `[[services]]`.

## Related work

- Spec: [`docs/sdd/workspace-release-ownership-split.md`](../sdd/workspace-release-ownership-split.md)
- Close-law pin: [`tests/workspace-governance.target.test.ts`](../../tests/workspace-governance.target.test.ts)
- Contributing: [`docs/guides/contributing.md`](../guides/contributing.md)
