# Semantic design tokens

Semantic migration is **opt-in and architectural**. Palette classes like `text-slate-800` may mean different things in different components, so replacements require analysis + an approved manifest. Generated utilities stay **complete static class names** (e.g. `text-foreground`) so Tailwind’s scanner can detect them.

Tailwind v4 exposes design tokens via `@theme` and `--color-*`. The tool generates those CSS variables; it does not maintain a separate JS Tailwind config for semantics.

## Phase 1 — Analyze

```bash
tailwind-canonicalize tokens analyze . --out tailwind-tokens.proposed.json
```

- Scans color utilities project-wide
- Scores contexts (component names, CVA variants, ARIA roles, nearby text, sibling classes)
- Groups co-occurring combinations → recipe proposals
- Proposes light/dark pairs (`bg-white` + `dark:bg-slate-950`)
- Loads existing CSS variables (prefer alias reuse)
- Reports duplicate values and alias cycles
- Writes a **proposal** manifest only — **no source edits**

## Phase 2 — Apply

```bash
tailwind-canonicalize tokens apply tailwind-tokens.json --write
```

Only **approved** mappings / pairs / recipes are applied.

Optional theme CSS (when `generateTheme.path` is set):

```css
:root { --app-background: #ffffff; }
.dark { --app-background: #020617; }
@theme inline {
  --color-background: var(--app-background);
}
```

Then:

```tsx
bg-white dark:bg-slate-950  →  bg-background
```

only when the pair is in the approved manifest (proven dual-theme).

## Recipes (foreground pair analysis)

Co-occurring surfaces prefer coherent targets:

```tsx
// sources present together
bg-amber-200 border-amber-200 text-slate-800
// →
bg-warning-subtle border-warning-subtle text-warning-foreground
```

not `text-foreground` alone.

## Manifest shape

See `packages/cli/schema/tokens.schema.json`.

```json
{
  "version": 1,
  "mappings": [
    {
      "source": "bg-white",
      "target": "bg-background",
      "token": "--color-background"
    }
  ],
  "pairs": [
    {
      "light": "bg-white",
      "dark": "bg-slate-950",
      "target": "bg-background",
      "token": "--color-background",
      "proven": true
    }
  ],
  "recipes": [],
  "generateTheme": {
    "path": "./src/styles/semantic-theme.css",
    "dualTheme": true,
    "preferAppAliases": true
  }
}
```

## Modes

| Mode | Semantic behavior |
|------|-------------------|
| `--safe` | Approved mappings/pairs only |
| `--review` | Report only; never write |
| `--aggressive` | May apply high-confidence inferred mappings (explicit opt-in) |

## Duplicate tokens

Exact value matches are **reported**, not merged. `background` and `card` may both be white and remain distinct unless the policy explicitly aliases them.

Existing `--warning-subtle` is reused as:

```css
@theme {
  --color-warning-subtle: var(--warning-subtle);
}
```

rather than inventing `--warning-background`.
