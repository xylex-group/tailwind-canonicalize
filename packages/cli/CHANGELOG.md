# tailwind-canonicalize

## 0.1.19

### Patch Changes

- 3603b7c: Rewrite width utilities onto unique Tailwind v4 `--container-*` tokens when the computed length matches exactly (`min-w-112` → `min-w-md`, `min-w-144` → `min-w-xl`). Keep padding/height on the spacing scale. Regression coverage for rem arbitrary values (`min-w-[3.25rem]` → `min-w-13`).
- **tokens report (v2):** portable POSIX paths in `styles-report.json` (no Windows `src\\…` keys); `byFile` / `topFiles`, palette·shade·variant rollups, health score, CSS/`@theme` analysis, and workflow `suggestions` for globals.css token work

## 0.1.18

### Patch Changes

- **Conflicts:** legacy `overflow-ellipsis` is **text-overflow** (not overflow) — no longer false-conflicts with `overflow-hidden` (common truncate pattern)

## 0.1.17

### Patch Changes

- **Conflicts:** `space-x-reverse` / `space-y-reverse` (and divide-*-reverse) no longer false-conflict with space amounts (`-space-y-1 space-y-reverse` co-occur by design)

## 0.1.16

### Patch Changes

- **Conflicts:** Tremor design-system `text-tremor-default|title|label|metric` are **font-size**, not color — no longer false-conflict with `text-tremor-content*`, `text-white`, `text-brand`, etc.

## 0.1.15

### Patch Changes

- **CLI:** `tokens report` — export a styling usage report (color utilities across text/bg/border/ring/fill/gradients/semantic tokens) with per-tag counts and drift signals; `-o`/`--out` JSON + optional `--md` markdown

## 0.1.14

### Patch Changes

- **Conflicts:** `inset-shadow-sm` vs `inset-shadow-white/20`; `drop-shadow-2xl` vs `drop-shadow-white/20` (elevation vs color)
- **Parse:** opacity on arbitrary values (`text-[13px]/3`) no longer misclassifies length as text-color

## 0.1.13

### Patch Changes

- **Safety:** border widths use the Tailwind px scale (`border-8` = 8px), never spacing (`border-2` ≠ 8px). Fixes false rewrites like `border-b-[8px]` → `border-b-2`, `border-b-[10px]` → `border-b-2.5`
- **Conflicts:** `bg-[length:…]` / size vs `bg-[linear-gradient(…)]` / image (not background-color); already fixed prose enable vs size and gradient stop position vs color (`from-10%` + `from-background`)

## 0.1.12

### Patch Changes

- **CLI:** value-taking flags (`--report` / `-o`, `--cwd`, …) reject flag-like next tokens so `--report -h` errors instead of writing a file named `-h`; support `--report=path` equals form

## 0.1.11

### Patch Changes

- **Conflicts:** bare `prose` no longer clashes with `prose-sm` (enable vs size); gradient stop **position** (`from-50%`) vs **color** (`from-popover`) split for `from`/`via`/`to`; full `display` map (`inline-flex`, `hidden`, …) so true display clashes are covered
- **CLI:** ANSI-colored `--help` (sections, flags, examples; respects `NO_COLOR` / `FORCE_COLOR`)

## 0.1.10

### Patch Changes

- Conflicts: stroke width vs color; snap axis vs strictness vs align; legacy `text-opacity-*`; prose size slot

## 0.1.9

### Patch Changes

- Conflicts: `text-2sm` (and `Nsm`/`Nmd`/`Nlg` scales) as font-size; `shadow-xs` as elevation; `decoration-dashed` vs `decoration-1` (style vs thickness)

## 0.1.8

### Patch Changes

- **Conflicts:** large reduction in false positives across property groups:
  - font family vs weight vs CSS size keywords (`font-small` / `font-smaller`)
  - text size aliases / `text-bold` weight vs text color; `text-[clamp()]` / `text-[length:…]` as font-size
  - divide axis vs color; object-fit vs object-position
  - background clip/position/size vs color; legacy `bg-opacity-*`
  - border width (`border-px`, `border-md`, `border-small`) vs color; side colors (`border-bottom-color` vs `border-left-color`); `border-collapse`
  - outline width/style/color (bare `outline`, `outline-2`, `outline-ring`)
  - shadow elevation vs color (`shadow-sm` vs `shadow-black/5`); ring vs `ring-opacity-*`
  - list-style type vs position; grid display vs custom `grid-tables` / `grid-kpis`
  - overflow known values vs plugin utilities (`overflow-stable`)
- **MDX / Astro / SFC:** do not full-file oxc-parse MDX; soft script/frontmatter errors so markup rewrites still run; ignore `.source` / `.contentlayer` / deploy artifacts
- **CLI:** improved `--help`; `-o` / `--report <file>` plain-text report output; version in footer (`· v0.1.8`); collapse parse-error spam; `--check --diff` shows real hunks (not empty headers)
- **Pipeline:** no-op when tokens unchanged (no trailing-space-only rewrites)

## 0.1.3

### Patch Changes

- Fix false conflict diagnostics (text/flex/border), make detectConflicts independent of collapseEquivalent, correct collapse originals, validate template spans, skip rewrites on parse errors, and improve colored CLI reporting.
