# Audit: xbp Cloudflare docs deploy (one-shot gaps)

**Date:** 2026-08-01  
**Scope:** First production deploy of `apps/docs` as Cloudflare Worker `tailwind-canonicalize-docs` on `tailwind-canonicalize.xbp.app`, and why `xbp deploy` could not do that in a single command from a clean consumer repo.  
**Outcome:** Live and healthy after manual scaffolding + deploy; redeploy path works. One-shot **bootstrap** is still missing.

---

## Executive summary

Deploy **succeeded** once the contract existed. The painful part was not Wrangler upload or DNS; it was **missing first-time bootstrap** for a static-assets Worker:

| Phase | Result |
|-------|--------|
| Auth (token) | Partial — env token worked, but xbp reported “not ready” until account ID was set |
| Project contract (`[[workers]]`, wrangler, provider) | **Missing** — had to invent by hand |
| `xbp cloudflare init` | Wrong shape (container-oriented; needs `--container-port`) |
| CLI flag placement | `--app` rejected after `deploy run` |
| Doctor path resolution | Misleading root (`…/docs` vs `apps/docs`) but deploy still worked |
| Plan / history | Noisy OCI + “containers rollout” for a plain static Worker |
| End-to-end after scaffolding | **OK** — `xbp deploy docs --to cloudflare --run --yes` → health 200 |

**Bottom line:** xbp is strong at *repeat* deploy once `wrangler.jsonc` + `[[workers]]` + `deploy.provider = cloudflare-worker` exist. It is weak at *first* deploy for static Blume/Astro docs: no scaffold, no domain wizard, incomplete CF readiness, and CLI ergonomics that cost a failed attempt.

---

## Provenance

| Field | Value |
|-------|--------|
| Repo | `xylex-group/tailwind-canonicalize` |
| Baseline commit (post-work) | `a362d51` — *Deploy docs via Cloudflare Worker* |
| Deploy history | `.xbp/deployments/20260801T145207Z-production-docs.json` |
| xbp version (record) | `10.59.0` |
| CF account | `a196ad9f98b8a2883f87e0d2d56ec3d5` (xylex-group) |
| Zone | `xbp.app` (`4460fcd3…`) |
| Worker | `tailwind-canonicalize-docs` |
| Custom domain | `tailwind-canonicalize.xbp.app` |
| Workers.dev | `https://tailwind-canonicalize-docs.xylex-group.workers.dev` |

**How this audit was built:** reconstruct from the live agent session (credential status, failed CLI, manual file writes, successful wrangler + `xbp deploy` run), plus the stored deploy JSON under `.xbp/deployments/`.

---

## What “good” one-shot would look like

Ideal first-time path from monorepo root:

```text
xbp cloudflare bootstrap-static \
  --app tailwind-canonicalize-docs \
  --root apps/docs \
  --assets dist \
  --domain tailwind-canonicalize.xbp.app \
  --build "pnpm run build" \
  --write --deploy --yes
```

Or, minimal:

```text
xbp deploy docs --to cloudflare --run --yes
```

…where xbp **detects** Blume/static `dist/`, **writes** wrangler + `[[workers]]`, **ensures** CF account ID, **binds** custom domain on zone `xbp.app`, **builds**, **deploys**, **probes** health — with zero hand-edited TOML.

What we actually needed is listed under [Timeline](#timeline-what-actually-happened).

---

## Timeline: what actually happened

### 1. Starting state (pre-scaffold)

`.xbp/xbp.toml` already had a `docs` **service**, but aimed at **Kubernetes**:

- `provider = "kubernetes"`
- OCI image `registry.xbp.app/xylex-group/docs`
- No `[[workers]]` block anywhere
- No `apps/docs/wrangler.jsonc`
- No `deploy` / `wrangler` scripts in `apps/docs/package.json`

`blume.config.ts` was already correct for intent (`adapter: "cloudflare"`, `site: "https://tailwind-canonicalize.xbp.app"`), so product config led the platform config — a classic drift direction.

### 2. Credential readiness false negative

`xbp config cloudflare status`:

- Token present via env (`cfut…`, verified, 1 account)
- User/account/primary slots unset (fine if env works)
- **Account ID missing** → overall **“Ready for CLI commands: not yet”**

Manual fix:

```text
# Account list via API → xylex-group
xbp config cloudflare set-account-id a196ad9f98b8a2883f87e0d2d56ec3d5
```

**Gap:** with a verified token that returns exactly one account, xbp should **auto-select** that account ID (or offer one-shot setup) instead of blocking readiness.

### 3. No static-worker init path

`xbp cloudflare init` requires:

- `--worker-root`
- `--container-port` (mandatory)

That models **Worker + Container** (athena-auth shape), not **assets-only** static docs. There is no first-class:

- assets directory
- not_found_handling / html_handling
- custom domain route
- package.json deploy script generation

So init was unusable for this app without lying about a container port.

### 4. CLI flag placement footgun

Failed:

```text
xbp cloudflare workers deploy run --app tailwind-canonicalize-docs
# error: unexpected argument '--app' found
```

Worked:

```text
xbp cloudflare workers --app tailwind-canonicalize-docs deploy run
```

**Gap:** global options only accepted on the parent command; agents and humans paste `--app` at the end by habit. Either accept `--app` on leaves, or print a remapping hint in the error (`did you mean … workers --app X deploy run`).

### 5. Manual scaffold (what filled the gap)

| Artifact | Role |
|----------|------|
| `apps/docs/wrangler.jsonc` | name, `assets.directory=./dist`, custom_domain route, 404-page |
| `apps/docs/package.json` | `wrangler` devDep; `deploy` = build + wrangler; `deploy:worker` |
| `.xbp/xbp.toml` `[[workers]]` | name/root/script_name/service |
| service `deploy.provider` | `cloudflare-worker` + destinations + health URL |
| `.gitignore` | `.xbp/deployments/`, `.wrangler/`, `worker-configuration.d.ts` |

None of this was generated by xbp.

### 6. Successful deploys

1. **Direct worker path:** `xbp cloudflare workers --app tailwind-canonicalize-docs deploy run`  
   - Ran package `deploy` → blume build → wrangler upload (256 assets)  
   - Bound custom domain + workers.dev  

2. **Service pipeline:** `xbp deploy docs --to cloudflare --run --yes --env production`  
   - doctor → wrangler types → build → deploy → **health 200** on `https://tailwind-canonicalize.xbp.app/`  
   - Record: `20260801T145207Z-production-docs` status `success`

### 7. Live verification (HTTP)

All 200: `/`, `/docs`, `/docs/installation`, workers.dev, `robots.txt`, `llms.txt`.

---

## Ranked findings (what went wrong / what hurts one-shot)

### P0 — No bootstrap for static Cloudflare Workers

**Symptom:** Clean repo with Blume static output cannot reach `xbp deploy … --run` without hand-written wrangler + workers table.  
**Why:** xbp cloudflare story is centered on container-backed Workers (`init` requires container port; skill docs emphasize athena-auth).  
**Impact:** First deploy always multi-step; agents reinvent wrangler shape.  
**Fix (xbp):**

1. `xbp cloudflare init --kind static|assets` (no container flags).
2. Flags: `--assets`, `--domain`, `--not-found 404-page|single-page-application`, `--workers-dev`, `--script-name`.
3. `--write` merges `[[workers]]` + flips linked service `deploy.provider` to `cloudflare-worker` when `--service docs` is set.
4. Optionally generate `package.json` scripts `deploy` / `deploy:worker` if missing.

### P0 — Account ID not auto-resolved

**Symptom:** Verified user token + single account still “not ready”.  
**Fix (xbp):** On `status` / before deploy, if account ID unset and `GET /accounts` returns one account, set or use it for the session and print “auto-selected account …”. Multi-account → interactive pick (or fail with list).

### P1 — Flag UX: `--app` only on parent

**Symptom:** Failed deploy attempt; wasted agent loop.  
**Fix (xbp):** Propagate common flags to leaves, or clap `allow_external` + rewrite; error message with corrected argv.

### P1 — Plan language still Kubernetes/OCI for pure Workers

From plan / history for a successful static deploy:

- Still prints `image: registry.xbp.app/xylex-group/docs:latest (config only — Cloudflare path does not GHCR-push)`
- Actions include **`containers rollout (worker default)`** for a worker with **no container contract**
- `namespace: tailwind-canonicalize` (k8s concept) next to cloudflare-worker
- `oci_plan.images.docs` populated

**Impact:** Operators distrust the plan; agents may try Docker/GHCR needlessly.  
**Fix (xbp):** When `provider = cloudflare-worker` and no container contract:

- Plan actions: `build (package)`, `wrangler deploy`, `probe health` only  
- Omit OCI image line or mark `n/a (assets worker)`  
- Drop “containers rollout”  
- Prefer `script_name` + `custom domains` in the plan summary  

### P1 — Doctor misleading root path

Doctor log (session):

```text
[docs] resolved app=tailwind-canonicalize-docs script=… root=apps/docs
…
worker_app=docs root=C:\Users\floris\Documents\GitHub\tailwind-canonicalize\docs
```

Second root is wrong (no top-level `docs/` app). Deploy still used `apps/docs` (history `root_directory` correct).  
**Impact:** Harder to trust doctor when debugging failures.  
**Fix (xbp):** Single resolved path for display; never invent sibling `docs` from service name without verifying exists.

### P2 — Blume-aware detection missing

Repo already declared Cloudflare intent in `blume.config.ts` (`deployment.adapter`, `deployment.site`). xbp never read it.  
**Fix (xbp or plugin):** If `blume.config.ts` / `astro.config` has site URL + static dist, suggest or write wrangler assets + domain from `deployment.site` hostname.

### P2 — Workers Builds not connected

Doctor: “no Builds triggers — connect Git under Worker → Settings → Builds”.  
Fine for CLI redeploy; not fine for “push to main → live”.  
**Fix (project):** Optional follow-up — connect repo in dashboard or `xbp cloudflare builds` once triggers exist.  
**Fix (xbp):** `bootstrap-static --with-builds` that wires build_command `pnpm run build` + root_directory `apps/docs` when Git is linked.

### P2 — Dual entrypoints without a recommended default

Working paths after scaffold:

```text
xbp deploy docs --to cloudflare --run --yes
xbp cloudflare workers --app tailwind-canonicalize-docs deploy run
pnpm --filter docs run deploy
```

All valid; docs in-repo didn’t exist.  
**Fix (project):** short `docs/guides/deploy-docs.md` (or README badge) with the **one** preferred command.  
**Fix (xbp):** `xbp deploy docs` with `provider=cloudflare-worker` should be the documented default; workers path as escape hatch.

### P3 — Generated types written into app tree

`wrangler types` during deploy created `apps/docs/worker-configuration.d.ts` (now gitignored).  
Harmless if ignored; surprising if committed by accident.  
**Fix:** Prefer write under `.wrangler/` or ensure project gitignore template includes `worker-configuration.d.ts` when scaffolding.

---

## What already worked (keep)

| Piece | Notes |
|-------|--------|
| Wrangler assets-only deploy | 288 files; custom_domain on `xbp.app` in same account Just Works |
| `_headers` from Blume | UTF-8 for `.md`/`.txt` honored on CF assets |
| Package `deploy` script composition | xbp `workers deploy run` invokes `pnpm run deploy` when present |
| `xbp deploy docs --to cloudflare --run` after contract | doctor + build + wrangler + health probe — this **is** the one-shot **redeploy** |
| Health URLs in service deploy | Plan probes `https://tailwind-canonicalize.xbp.app/` → 200 |
| Deploy history under `.xbp/deployments/` | Good for audit; correctly gitignored after fix |
| Zone ownership | `xbp.app` on same CF account → custom domain without manual DNS records |

**Redeploy one-shot (works today):**

```powershell
$env:CLOUDFLARE_ACCOUNT_ID = "a196ad9f98b8a2883f87e0d2d56ec3d5"  # if not already in xbp config
xbp deploy docs --to cloudflare --run --yes --env production
```

---

## Target architecture (contract that should exist at t=0)

```text
apps/docs/
  wrangler.jsonc          # name, assets → dist, routes custom_domain
  package.json            # build, deploy, deploy:worker
  dist/                   # blume build output (gitignored)

.xbp/xbp.toml
  [[services]] name = "docs"
    deploy.provider = "cloudflare-worker"
    destinations.cloudflare.script_name / health_urls
  [[workers]]
    name / root / script_name / service = "docs"
```

Minimum wrangler shape that shipped:

```jsonc
{
  "name": "tailwind-canonicalize-docs",
  "compatibility_date": "2026-06-21",
  "workers_dev": true,
  "assets": {
    "directory": "./dist",
    "not_found_handling": "404-page",
    "html_handling": "auto-trailing-slash"
  },
  "routes": [
    { "pattern": "tailwind-canonicalize.xbp.app", "custom_domain": true }
  ]
}
```

---

## Improvement backlog (actionable)

### In **xbp** (platform — highest leverage for “next repo”)

| ID | Change | One-shot effect |
|----|--------|-----------------|
| X1 | `cloudflare init --kind assets` + domain/assets flags | Scaffold without container fiction |
| X2 | Auto account ID when token sees 1 account | Removes readiness blocker |
| X3 | Accept `--app` on nested `workers deploy *` | Stops false CLI failures |
| X4 | Plan sanitization for non-container workers | Honest plan; no OCI/containers noise |
| X5 | Doctor single source of truth for worker root | Trustworthy preflight |
| X6 | Optional: read `blume.config` / `package.json#scripts.build` | Zero-config domain + build |
| X7 | `bootstrap-static --deploy` composite command | True first-time one-shot |

### In **tailwind-canonicalize** (this repo — done or leftover)

| ID | Status | Note |
|----|--------|------|
| R1 | Done | wrangler + workers + provider + health |
| R2 | Done | deploy scripts + wrangler dep |
| R3 | Done | gitignore deployments / wrangler types |
| R4 | Optional | README / `docs/guides/deploy-docs.md` with one preferred command |
| R5 | Optional | Cloudflare Workers Builds Git integration for push-to-deploy |
| R6 | Optional | Persist CF token via `xbp config cloudflare set-key` (not only env) |

### In **agent/skill docs** (`~/.grok/skills/xbp`)

| ID | Change |
|----|--------|
| S1 | Document static assets path alongside container path |
| S2 | Document flag order: `xbp cloudflare workers --app X deploy run` |
| S3 | Checklist: account ID, wrangler.jsonc, `[[workers]]`, provider, health URL |
| S4 | Prefer `xbp deploy <svc> --to cloudflare --run --yes` as default redeploy |

---

## Recommended reduction of friction (sequence)

1. **Today (operators):** use `xbp deploy docs --to cloudflare --run --yes` only — contract is in repo.  
2. **xbp next:** X2 (account auto) + X3 (flag UX) — cheap, stops false “not ready” / parse errors.  
3. **xbp next:** X1 + X4 — first-time static apps stop needing this audit.  
4. **Optional product:** X6/X7 + Workers Builds for fully hands-off main-branch deploys.

---

## Failure-mode matrix (for future agents)

| If you see… | Likely cause | Do this |
|-------------|--------------|---------|
| Ready for CLI: not yet | Missing account ID | `set-account-id` or auto-select; confirm `status` |
| `unexpected argument '--app'` | Flag after leaf | Put `--app` after `workers` |
| No worker apps / picker empty | No `[[workers]]` | Write workers block or `init --kind assets --write` |
| Deploy tries k8s / ImagePull | `provider` still kubernetes | Set `cloudflare-worker` + destination |
| wrangler “assets directory empty” | No build | `pnpm --filter docs run build` first |
| Custom domain fails | Zone not in account | Confirm zone on same account as worker |
| Doctor shows wrong root | Path resolution bug | Trust plan `root_directory`; fix xbp doctor display |
| Plan mentions containers/OCI | Provider noise | Ignore if no container contract; fix plan text in xbp |

---

## Conclusion

**Nothing was wrong with the final Cloudflare runtime path** — static assets + custom domain on `xbp.app` is solid, and the **redeploy** pipeline (`xbp deploy docs --to cloudflare --run --yes`) is already one-shot.

What went wrong was the **missing first-time contract and incomplete CF readiness/UX**: xbp assumed either a container worker or a pre-existing Wrangler project, while this app was a Blume static site with only product-level Cloudflare intent. Closing the bootstrap gap (assets init, account auto-pick, cleaner plans, better CLI flags) is what makes the **next** app a true one-shot from zero.
)
