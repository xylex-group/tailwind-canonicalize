# Safety guarantees

## Hard rules

| Rule | Behavior |
|------|----------|
| Unknown value | Leave untouched |
| `calc` / `var` / `min` / `max` / `clamp` | Leave untouched |
| Arbitrary properties | Leave untouched |
| Zero candidates | Leave untouched |
| Multiple candidates | Leave untouched (unless a documented preference applies) |
| Non-exact color | Leave untouched |

## Why px ↔ rem is allowed

Tailwind's default spacing unit is `0.25rem`. At a 16px root:

| Arbitrary | Scale | Resolved |
|-----------|-------|----------|
| `40px` | `10` | `2.5rem` |
| `16px` | `4` | `1rem` |
| `8px` | `2` | `0.5rem` |

These are the design-token identities authors mean when they type pixel arbitraries. Root font size is configurable (`--root-font-size`) for projects that use a different base.

## What "unsafe" means

An **unsafe rewrite** would change computed styles for some viewport, root font size, or cascade context. The engine refuses ambiguous or non-exact matches rather than guessing, so applied rewrites in safe mode always have `safety: "safe"`.

CLI summary fields:

| Field | Meaning |
|-------|---------|
| `replacements` | Applied token rewrites |
| `conflicts` | Competing utilities in the same cascade slot (reported, not auto-fixed) |
| `parse errors` | Extract/parse failures — **file left untouched** |
| `non-safe rewrites` | Applied rewrites with `safety` other than `safe` (aggressive/review modes only) |

Conflicts are **not** unsafe rewrites: no class text was changed for those diagnostics.

## Malformed source

Parse errors are recorded and the file is **not rewritten**. The tool continues with other files. Exit code `2` is reserved for operational failures.
