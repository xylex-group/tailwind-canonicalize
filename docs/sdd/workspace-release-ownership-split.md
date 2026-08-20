# Workspace / release / environment ownership consolidation

| Field | Value |
| --- | --- |
| Debt | **`workspace-release-ownership-split`** (exactly one debt id) |
| Workflow | `xylex-sdd-consolidation` |
| Disposition | **CONSOLIDATE** (capability exists; do not CREATE a new workspace topology) |
| Bounded context | `workspace-release-environment` |
| Canonical owner | **`package.json`** (root: `packageManager`, `scripts`, Changesets entrypoints) |
| Close law | Exactly one class per pnpm-workspace member (`internal` \| `publishable` \| `integration` \| `app` \| `tooling`); `pnpm@packageManager` is the only Node execution authority; Changesets is the only npm version authority and XBP is orchestration/ledger only; CI invokes root scripts rather than reconstructing them; generated outputs are ignored or regenerated with `git diff --exit-code`; composite `action.yml` is the only Action architecture |
| ADR | **new** — none exists; draft [`docs/adr/0001-workspace-release-ownership.md`](../adr/0001-workspace-release-ownership.md) |
| Dual-suite | `tests/workspace-release-ownership.baseline.test.ts` (GREEN on CURRENT) and `tests/workspace-release-ownership.target.test.ts` (RED on CURRENT). Vitest already includes `tests/**/*.test.ts`. **No** dedicated SDD binary. **No** `tests/sdd/`. |
| Status | **Closed** — consolidated onto root `package.json` + Changesets (2026-08-20). Inventory: [`docs/architecture/debt.md`](../architecture/debt.md). ADR: [`docs/adr/0001-workspace-release-ownership.md`](../adr/0001-workspace-release-ownership.md) (**accepted**) |

This is not a product-feature spec. It retires competing definitions of the repository (membership, tasks, versions, generate, deploy) onto owners that already exist.

---

## Discovery (complete)

| Question | Answer |
| --- | --- |
| Existing capability search | **Exists.** Layered packages (`parser` → `resolver` → `transformer` / `tokens` → `compiler` → `cli` / `vscode`), root pnpm workspace, Changesets (`pnpm version-packages` / `pnpm release`), composite GitHub Action, XBP ledger + Cloudflare docs worker, root scripts (`check`, `test`, `build`, `typecheck`). Debt is **split ownership**, not missing capability. |
| Canonical owner | Root **`package.json`**. Membership list lives in `pnpm-workspace.yaml` but is not a second product owner; it enumerates members that `package.json` scripts and Changesets consume. |
| Affected bounded context | `workspace-release-environment` (workspace graph, task graph, npm version, generate/deploy, Action architecture). Not the rewrite pipeline. |
| Existing APIs / types to reuse | `package.json#packageManager`, `package.json#scripts`, `pnpm-workspace.yaml`, `.changeset/config.json`, `changeset version`, `changeset publish`, `action/action.yml`. |
| New public surface required? | **No.** Do not publish internals; do not add a new npm name; do not fold layers into the CLI. |
| New persistence required? | **No.** Do not add Turbo, a second lockfile, or a new version store. Keep Changesets files + XBP **ledger**. |
| New ADR required? | **Yes** (`adr_action=new`). No `docs/adr/` tree. Draft records Changesets-only npm versioning, XBP ledger/orchestration only, one class per member. |

---

## Classify (binding)

| Key | Value |
| --- | --- |
| `capability_exists` | `true` |
| `disposition` | `CONSOLIDATE` |
| `canonical_owner` | `package.json` |
| `bounded_context` | `workspace-release-environment` |
| `debt_id` | `workspace-release-ownership-split` |
| `adr_action` | `new` |
| `new_adr_required` | `true` |
| `new_public_surface` | `false` |
| `new_persistence` | `false` |
| `create_justification` | _(empty — do not CREATE)_ |
| `next_workflow` | `xylex-sdd-consolidation` |
| `governing_adr` | _(none — draft 0001)_ |
| `inventory_command` | `pnpm list -r --depth -1 --json` |
| `guard_command` | `pnpm check && pnpm typecheck && pnpm test && pnpm build` |
| `regression_command` | `pnpm test && pnpm typecheck && pnpm build` |

Reuse APIs: `package.json#packageManager`, `package.json#scripts`, `pnpm-workspace.yaml`, `.changeset/config.json`, `changeset version`, `changeset publish`, `action/action.yml`.

### Competing representations

`pnpm-workspace.yaml`, `tsconfig.json`, `package.json`, `vitest.config.ts`, `.changeset/config.json`, `.xbp/xbp.toml`, `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `packages/*/package.json`, `packages/cli/tsup.config.ts`, `action/action.yml`, `action/src/index.ts`, `knip.json`, `apps/docs/.blume`, `docs/architecture/overview.md`, `packages/compiler/package.json`.

### Consumers

`.github/workflows/ci.yml`, `changesets/action`, `.xbp/xbp.toml`, `packages/cli`, `packages/compiler`, `packages/parser`, `packages/resolver`, `packages/transformer`, `packages/tokens`, `packages/vscode`, `action/action.yml`, `apps/docs`, `vitest.config.ts`, `knip.json`, `npm:tailwind-canonicalize`, `docs/guides/contributing.md`, `AGENTS.md`.

### Superseded paths (retire, do not alias)

- `.github/workflows/release.yml` (dormant `npx semantic-release`)
- `action/src/index.ts` and `action/tsconfig.json` (unused Node Action entry)
- `packages/{parser,resolver,transformer,tokens,compiler}/package.json#publishConfig`
- `.xbp/xbp.toml#services.public` (directory `apps/docs/public` as a k8s/vercel “service”)
- `.xbp/xbp.toml#publish.npm` (`npm publish` beside Changesets)
- tracked `apps/docs/.blume` (generated Blume/Astro state)

### Compatibility-only (sunset 2026-10-01)

| Path | Why it stays briefly | Sunset |
| --- | --- | --- |
| `packages/cli` | Dual CLI + library npm name `tailwind-canonicalize` (bin + `exports`); internals bundled into this tarball | 2026-10-01 |
| `packages/cli/tsup.config.ts` | Bundles `../compiler/src/worker.ts` from source (`noExternal` workspace packages) | 2026-10-01 |
| `vitest.config.ts` | Source aliases to `packages/*/src` instead of `dist` | 2026-10-01 |

Do not treat these as a second publishable surface or a second membership list. After sunset: still one publishable npm package; worker entry and test resolution must not invent a second owner.

### Expected reductions (inventory delta after close)

| Metric | Δ | Meaning on this repo |
| --- | --- | --- |
| `duplicate_helpers` | **8** | `.changeset/config.json` `ignore` length (8 members treated as “not Changesets” while still carrying identity/version metadata) |
| `duplicate_types` | **5** | Internals with `private: true` **and** `publishConfig.access=public` (`parser`, `resolver`, `transformer`, `tokens`, `compiler`) |
| `persistence_representations` | **4** | Competing version/generate stores: Changesets vs XBP `version_targets` vs semantic-release vs `[publish.npm]` (npm authority collapses to Changesets; XBP ledger is not a version store) |
| `projection_paths` | **11** | Eleven `[[services]]` directory-as-service mappings in `.xbp/xbp.toml` (and the 11 superseded_paths) |
| `public_symbols` | **0** | No new public API |
| `root_test_binaries` | **0** | No dedicated SDD / xtask test binary |

---

## Problem

Maintainers cannot answer “what is a package, who versions it, who runs tasks, and what is generated” from one owner. Root `package.json` already has `packageManager`, scripts, and Changesets entrypoints, but CI, XBP, dormant semantic-release, quasi-publishable internals, knip, tsc project refs, tracked `.blume`, and an unused Action TypeScript entry each assert a different repository.

User-visible goal: one class per workspace member, one Node executor (`pnpm@9.15.0` from `packageManager`), one npm version authority (Changesets → `tailwind-canonicalize` on npm), XBP as orchestration/ledger only, CI that calls `pnpm check` / `pnpm test` / `pnpm build`, generated outputs not committed (or proven with `git diff --exit-code`), and a composite Action only. Layered packages stay. npm consumers still install `tailwind-canonicalize`.

---

## Current behavior

Characterization of **today** (must be what baseline tests encode).

### Membership (nine pnpm members, several projections)

`pnpm-workspace.yaml` members: `packages/*` (`parser`, `resolver`, `transformer`, `compiler`, `tokens`, `cli`, `vscode`), `apps/*` (`docs`), `action`.

| Member | `name` | `private` | version today | Other projections |
| --- | --- | --- | --- | --- |
| `packages/parser` | `@tailwind-canonicalize/parser` | `true` | `0.1.0` | `files`/`exports`/`publishConfig.access=public`; Changesets **ignored**; XBP service `tailwind-canonicalize-parser`; in `tsc -b` refs |
| `packages/resolver` | `@tailwind-canonicalize/resolver` | `true` | `0.1.0` | same quasi-publishable shape; XBP service; tsc refs |
| `packages/transformer` | `@tailwind-canonicalize/transformer` | `true` | `0.1.0` | same |
| `packages/tokens` | `@tailwind-canonicalize/tokens` | `true` | `0.1.0` | same |
| `packages/compiler` | `@tailwind-canonicalize/compiler` | `true` | `0.1.0` | same; README + `docs/architecture/overview.md` call it **Public API** |
| `packages/cli` | `tailwind-canonicalize` | unset (publishable) | **`0.1.19`** | only Changesets non-ignored package; tsup bundles internals; XBP `versioning_disabled` includes `packages/cli` **and** `cli` while `version_targets` still lists `packages/cli/package.json`; `[publish.npm]` `npm publish` from `packages/cli` |
| `packages/vscode` | `tailwind-canonicalize-vscode` | `true` | `0.1.1` | Changesets ignored; knip **ignored**; **not** in root `tsconfig.json` references; XBP service with version_targets |
| `apps/docs` | `docs` | `true` | `0.0.2` | Changesets ignored; Blume app + Wrangler; XBP `docs` worker **and** k8s `public` service on `apps/docs/public` |
| `action` | `tailwind-canonicalize-action` | `true` | `0.1.0` | Changesets ignored; knip ignored; composite `action.yml` **and** unused `action/src/index.ts` + `tsc` build; XBP k8s/pm2 service |

Root `package.json`: `name=tailwind-canonicalize-monorepo`, `private`, **`version: "0.2.0"`**, `packageManager: "pnpm@9.15.0"`. README header says current version `0.2.0` while npm badge/body say `0.1.19`. XBP `project_name` / `version = "0.2.0"` and ledger `service-tailwind-canonicalize-0.2.0.toml` follow the root, not npm.

`tsconfig.json` project references: parser, resolver, transformer, tokens, compiler, cli — **not** vscode, docs, action. `pnpm typecheck` is `tsc -b` over that graph only.

`knip.json` workspaces: `.` and `packages/*`; **ignore** `packages/vscode/**`, `action/**`. Docs/app is not a knip workspace.

No member has an explicit class field. Intended classes are not enforced.

### Task / Node execution authorities

- **Owner (unused by CI):** root `package.json#packageManager` = `pnpm@9.15.0`; scripts `check` (`ultracite check` + prettier astro), `test` (`vitest run`), `build`, `typecheck`, `release`.
- **CI reconstructs:** `.github/workflows/ci.yml` uses `pnpm/action-setup@v4` with **`version: 9`** (not Corepack/`packageManager`), then `pnpm exec biome check packages tests` instead of `pnpm check`. Test job does run `pnpm typecheck`, `pnpm build`, `pnpm test`.
- **XBP reconstructs:** eleven `[[services]]` each invent `npm run start` / `npm run lint` / `npm test` (or `pnpm run *`) for directories that are not process services. `action/package.json` has **no** `start`/`dev`/`lint`/`test` scripts; internals have `build`/`typecheck` only.
- **Action TS:** `action/package.json` `"build": "tsc -p tsconfig.json"` is not invoked by the live composite action (which `npx`s npm `tailwind-canonicalize`).

### Version authorities (four)

1. **Changesets** — `.changeset/config.json` `ignore` is the eight non-CLI members; `changesets/action` on `main` runs `pnpm release` (`pnpm build && changeset publish`). Live npm: `tailwind-canonicalize@0.1.19`.
2. **XBP** — `version_targets` lists **every** `package.json` including root; `versioning_disabled` then lists action, compiler, parser, resolver, tokens, transformer, **cli**, and `apps/docs/public`. Ledger under `.xbp/releases/` (7 tracked TOMLs) and `.xbp/versioning/history.jsonl`. Project version `0.2.0` ≠ npm `0.1.19`.
3. **semantic-release** — `.github/workflows/release.yml` `workflow_dispatch`, `npx semantic-release`. Not a package.json dependency. Comment: “Optional alternative to changesets”.
4. **`[publish.npm]`** — enabled; `working_directory = packages/cli`; `publish_command = "npm publish --access public"`. Parallel to `changeset publish`.

### Generate / deploy

- `dist/` and `**/.wrangler/` are gitignored; `apps/docs/dist` is **not** tracked (0 files).
- `apps/docs/.gitignore` ignores **`.blume-verify/` only**. **67** generated files under `apps/docs/.blume` are **tracked**.
- CI has **no** `git diff --exit-code` after generate/docs build.
- Docs deploy: `pnpm docs:deploy` → `blume build && wrangler deploy`. XBP `[[workers]]` `tailwind-canonicalize-docs` is the real Cloudflare path; `[[services.public]]` (vercel/k8s on `apps/docs/public`) is a false deploy target. `.xbp/deployments/` is gitignored (ledger of deploys); `.xbp/releases/` is tracked.

### Action architecture (two)

Live: `action/action.yml` `runs.using: composite` (setup-node + `npx tailwind-canonicalize`). Dead: `action/src/index.ts` imports `run` from `tailwind-canonicalize` for a Node action that is not referenced by `action.yml`.

### Governance tests

**None.** `tests/` contains `fixtures.test.ts` only. No ownership/class/CI/version assertions.

---

## Desired behavior

### One class per member (close-law clause 1)

Keep the **same nine** `pnpm-workspace.yaml` members. Do not fold `parser` into `cli`. Do not add Turbo as owner. Do not mint a tenth member or a second workspace file.

| Member | Class | Law |
| --- | --- | --- |
| `@tailwind-canonicalize/{parser,resolver,transformer,compiler,tokens}` | **internal** | `private: true`; **no** `publishConfig`; workspace deps only; still real packages with `exports` for in-repo use; Changesets **ignore** |
| `tailwind-canonicalize` (`packages/cli`) | **publishable** | Sole npm publish; sole Changesets non-ignored package; `changeset version` / `changeset publish` only |
| `tailwind-canonicalize-vscode` | **integration** | Private VS Code extension; not npm; not knip-silent without a documented ignore tied to this class |
| `docs` | **app** | Blume + Wrangler; deploy via root `docs:*` scripts / XBP **worker**; not npm |
| `tailwind-canonicalize-action` | **tooling** | Composite `action.yml` only |

Root `package.json` remains private workspace root (not a member). Its `version` field is **not** an npm version; it must not advertise a different current npm version than Changesets/`packages/cli`.

### Node execution (clause 2)

`package.json#packageManager` (`pnpm@9.15.0`) is the only pin. CI uses pnpm from that field (Corepack or `pnpm/action-setup` **without** a competing `version: 9`). CI lint is `pnpm check`, not `pnpm exec biome check packages tests`. XBP service commands, when present, **must** be root `pnpm run <script>` (or `pnpm --filter …`) that exist in `package.json`; no invented `npm run start` on libraries.

### Version (clause 3)

Changesets is the only npm version authority. XBP may keep `.xbp/releases` / `history.jsonl` as **ledger** and may orchestrate docs deploy (`[[workers]]`, Cloudflare). XBP must **not**: bump every `package.json` via `version_targets` as an npm authority; enable `[publish.npm]`; map each directory as a versioned k8s/npm/pm2 service. Delete or disable `.github/workflows/release.yml` semantic-release. Internals drop `publishConfig`.

### CI scripts (clause 4)

`.github/workflows/ci.yml` invokes root scripts: `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm build` (and `pnpm release` via changesets/action on `main`). It does not reconstruct biome scope or pnpm major.

### Generated outputs (clause 5)

`apps/docs/.blume` is gitignored (like `dist` / `.wrangler`) **or** regenerated in CI with `git diff --exit-code`. Do not track 67 generated files while ignoring only `.blume-verify`. If a generate step is required for docs, CI must fail on dirty tree.

### Action (clause 6)

`action/action.yml` composite is the only architecture. Remove unused `action/src/index.ts` and `action/tsconfig.json` (and the dead `tsc` build) rather than shipping a second Node action.

### Compatibility-only until 2026-10-01

CLI may keep bundling internals (`tsup` `noExternal` + worker from `compiler/src/worker.ts`) and vitest may keep source aliases. They are not a second publishable package and not a second class. After sunset, resolution still has one owner (built `dist` or an explicit documented alias), not a new package.

### Dual-suite

- Baseline under `tests/` **characterizes** the competing authorities above and **passes on CURRENT**.
- Target under `tests/` **encodes the close law** and **fails on CURRENT** until config/docs/CI are consolidated.
- After target GREEN, **delete** the baseline file (do not `#[ignore]` / skip forever). Keep the target as the uniqueness pin.
- Do not add a dedicated SDD binary or a second test runner.

---

## Close law (machine-checkable)

Verified only when **all** hold:

1. Each of the nine pnpm-workspace members has exactly one class in `{internal, publishable, integration, app, tooling}` matching the table; no member is quasi-publishable (`private` + `publishConfig.access=public`).
2. No workflow or tool pins pnpm except `packageManager`; CI calls `pnpm check` (not reconstructed biome paths).
3. The only Changesets non-ignored workspace package is `tailwind-canonicalize`; no `semantic-release` workflow; no `[publish.npm]`; XBP `version_targets` is not an npm authority (ledger/orchestration only; no `[[services]]` for `apps/docs/public` or per-package k8s libraries).
4. CI does not reconstruct root scripts.
5. Generated `.blume` is ignored or CI `git diff --exit-code` after regenerate; `dist` / `.wrangler` stay ignored.
6. The Action has composite `action.yml` and no unused `action/src` tsc entry.

Green unit tests with internals still `publishConfig`’d, or CI still pinning `version: 9`, are **not** done.

---

## Dual-suite protocol (next phases — not this spec)

| File | Role | On CURRENT tree | After implement |
| --- | --- | --- | --- |
| `tests/workspace-release-ownership.baseline.test.ts` | Characterization | **GREEN** (split authorities exist) | **Deleted** after target GREEN |
| `tests/workspace-release-ownership.target.test.ts` | Close law | **RED** | **GREEN**; keep as pin |

Baseline asserts (examples, not implementation): Changesets ignore length 8; five internals have `publishConfig.access=public`; CI yaml contains `version: 9` and `pnpm exec biome check packages tests`; `release.yml` contains `npx semantic-release`; `xbp.toml` has `[publish.npm]` and a `[[services]]` `name = "public"`; 67 tracked files under `apps/docs/.blume`; `action/src/index.ts` exists; root `version` is `0.2.0` while `packages/cli` is `0.1.19`; knip ignores `action/**` and `packages/vscode/**`; tsconfig refs omit vscode.

Target asserts the close-law clauses (product/config state), **not** by reading its own source and forbidding a substring that appears in the assertion (xylex-sdd AC-2 / I4a).

---

## Acceptance criteria

1. Baseline suite GREEN on CURRENT: competing authorities characterized as they exist (Changesets ignore 8, five `publishConfig` internals, CI pnpm `version: 9` + reconstructed biome, dormant semantic-release, XBP `[publish.npm]` + 11 `[[services]]` including `public`, 67 tracked `.blume` files, unused `action/src/index.ts`, root `0.2.0` vs CLI `0.1.19`).
2. Target suite RED on CURRENT then GREEN after consolidation: close law holds; baseline deleted; target kept; tests live under `tests/**/*.test.ts` only (no dedicated SDD binary).
3. Exactly one class per pnpm-workspace member per the desired table; internals have `private: true` and **no** `publishConfig`; only `tailwind-canonicalize` is Changesets-published to npm.
4. `package.json#packageManager` is the only Node/pnpm pin; CI uses it and runs `pnpm check` (not `pnpm exec biome check packages tests`).
5. Changesets is the only npm version authority; `.github/workflows/release.yml` gone or not semantic-release; `.xbp/xbp.toml` has no `[publish.npm]` and no directory-as-service mappings for libraries/`apps/docs/public`; XBP remaining config is orchestration/ledger (`[[workers]]`, releases history) only.
6. Generated `apps/docs/.blume` is gitignored **or** CI regenerates and `git diff --exit-code`; `dist` and `.wrangler` remain ignored.
7. Composite `action/action.yml` is the only Action architecture; `action/src/index.ts` and `action/tsconfig.json` retired.
8. Layered packages remain separate (`parser` → `resolver` → `transformer`/`tokens` → `compiler` → `cli`/`vscode`); no fold into CLI; no Turbo owner; no new workspace topology.
9. Compatibility-only paths (`packages/cli` dual surface, `tsup` compiler worker, vitest source aliases) documented with sunset **2026-10-01**; not a second publishable package.
10. Inventory deltas: `duplicate_types` −5, `duplicate_helpers` −8, `persistence_representations` −4, `projection_paths` −11, `public_symbols` 0, `root_test_binaries` 0.
11. ADR 0001 accepted (or proposed→accepted in DocsAdr) recording Changesets-only npm versioning, XBP ledger/orchestration only, one class per member.
12. `pnpm check && pnpm typecheck && pnpm test && pnpm build` green after implement; contributing/CI/architecture docs no longer describe compiler as a separately published public npm API or semantic-release as an alternative.

---

## Out of scope

- Folding `parser` / `resolver` / `transformer` / `tokens` / `compiler` into `packages/cli`
- Creating a new workspace topology, second lockfile, or Turbo as task owner
- Publishing internals or adding a new public npm package name
- Rewriting the canonicalize pipeline, theme matching, or CLI flags
- VS Code Marketplace publish automation (integration class stays; not this debt)
- Replacing Blume or Cloudflare Worker docs hosting
- Deleting the XBP **ledger** (`.xbp/releases`, `history.jsonl`) or the docs `[[workers]]` orchestration
- A dedicated SDD / xtask test binary or `tests/sdd/`
- New persistence (version database, extra Changesets linked groups for internals)
- Expanding knip into a second membership SSOT
- Migrating the Action to `node20` with a compiled `dist` (composite stays)
- Changing npm `tailwind-canonicalize` public API surface
- Rebase of historical XBP 0.2.0 ledger entries to 0.1.19 (ledger is history)
- Implementing this spec in the same change as writing it

---

## Risks

| Risk | Mitigation |
| --- | --- |
| Folding layers “to simplify publish” | Close law + AGENTS.md: keep parser→cli layers; CLI bundles internals until sunset |
| XBP deleted entirely | Spec: ledger + `[[workers]]` stay; only services-as-directories and `[publish.npm]` / version_targets-as-npm retire |
| `private` internals break CLI tarball | tsup `noExternal` already bundles; `publishConfig` removal must not be replaced by publishing internals |
| CI `pnpm check` is wider than `biome check packages tests` | Intended; root `check` is the owner. If astro prettier fails, fix fixtures — do not reconstruct a narrower biome path |
| Ignoring `.blume` breaks docs preview without generate | Document `pnpm docs:build`; CI regenerate + `git diff --exit-code` if any generated path must stay tracked |
| Target RED for unrelated product needles | Target reads workspace/CI/XBP/Action **config state**, not rewrite fixtures |
| Root `version: 0.2.0` leftover as fake npm current | Target: README/npm current equals Changesets CLI version; root version is not advertised as npm |
| Knip starts failing on vscode/action when ignore is dropped | Class-based ignore is allowed if documented as integration/tooling, not a silent second membership |
| Dual-suite becomes a permanent baseline | Delete baseline after GREEN; keep target pin only |
| Compatibility aliases become a second owner after 2026-10-01 | Sunset dates on the three paths; follow-up must not add a new package |
| semantic-release dispatch still used by humans | Remove workflow so `workflow_dispatch` cannot fork versions |
| ADR never written because “just config” | `adr_action=new`; 0001 is required for version authority + class law |

---

## ADR

- **Needed:** yes (`classify.adr_action=new`; no governing ADR).
- **Accepted:** [`docs/adr/0001-workspace-release-ownership.md`](../adr/0001-workspace-release-ownership.md). No sibling ADR. No supersession.

---

## Verify (implementation phases — not this spec)

```text
pnpm list -r --depth -1 --json
pnpm check && pnpm typecheck && pnpm test && pnpm build
```

Target tests must fail on CURRENT for close-law reasons, then pass only after superseded_paths are actually gone.
