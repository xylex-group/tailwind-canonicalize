# tailwind-canonicalize

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
