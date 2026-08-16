# Transformation categories

Every rewrite is tagged with a category. Categories stay separate internally because they have different safety guarantees and review expectations.

```ts
type TransformationCategory =
  | "canonical-class"
  | "tailwind-migration"
  | "semantic-color-token"
  | "semantic-spacing-token"
  | "duplicate-token-removal"
  | "theme-normalization";
```

## Pipeline order

1. **tailwind-migration** — versioned registry renames (`bg-gradient-to-br` → `bg-linear-to-br`)
2. **canonical-class** — arbitrary values → theme tokens when exactly equivalent (spacing uses continuous `--spacing` multipliers, e.g. `w-[140px]` → `w-35`, not only the classic discrete key table). Width utilities also collapse onto unique `--container-*` names (`min-w-112` → `min-w-md`, `min-w-144` → `min-w-xl`) when the computed length matches exactly.
3. **semantic-color-token / semantic-spacing-token** — **approved manifest only**
4. **duplicate-token-removal** — exact dups and equivalent competitors (`max-w-40 max-w-[160px]`)
5. **conflict diagnostics** — competing different values (no silent pick)

## Safety modes

| Mode | Behavior |
|------|----------|
| `--safe` (default) | Exact canonical + safe migrations + approved tokens + dups |
| `--review` | Report/propose only; never write |
| `--aggressive` | Also apply `safety: "review"` migrations when enabled |

Semantic palette → token inference is **never** auto-written. Use:

```bash
tailwind-canonicalize tokens analyze .
# review proposed manifest
tailwind-canonicalize tokens apply tailwind-tokens.json --write
```
