# Canonicalization algorithm

## Per token

1. **Parse** the utility into `{ variants, important, negative, namespace, value }`.
2. If the value is **not** arbitrary (`[…]`), stop (no rewrite).
3. If the utility is an **arbitrary property** (`[mask-image:…]`), stop.
4. Extract the inner value. If it contains `calc(`, `var(`, `min(`, `max(`, `clamp(`, or `url(`, stop.
5. If the inner value is a known **keyword** for that namespace (`100%` → `full`, `100vh` → `screen`, …), emit that candidate.
6. Otherwise, select the **theme scale(s)** for the namespace (spacing, radius, fontSize, colors, …).
7. For each scale entry `(key, cssValue)`, if `normalize(inner) == normalize(cssValue)`, collect `key`.
8. Deduplicate keys.
9. **Decision:**
   - 0 matches → no rewrite
   - 1 match → rewrite to that key
   - \>1 matches → attempt **safe preference** (e.g. `1/2` over `2/4`, named radius over numeric). If still ambiguous → no rewrite
10. Reassemble with original variants / important / negative sign.

## Normalization

Lengths:

- `px` and unitless numbers compare as px
- `rem` / `em` convert via `rootFontSizePx` (default **16**)
- `%` compares as percent only
- viewport units compare within the same unit family

Colors:

- Hex expanded to 6 digits, lowercased
- Functional colors compared after whitespace stripping

## Equivalence philosophy

```
if normalized(theme[candidate]) == normalized(arbitrary)
  then candidate is eligible
```

This is the practical form of:

```
compiled(original) == compiled(candidate)
```

for design-token utilities, without requiring a full Tailwind compile on every token. An optional `compileEqual` hook is reserved for strict compile-time comparison when a project embeds the Tailwind compiler.

## Class strings

Tokens are split on whitespace (including newlines). Each token is rewritten independently. Leading/trailing and inter-token whitespace is preserved so multi-line `className` blocks keep their shape.
