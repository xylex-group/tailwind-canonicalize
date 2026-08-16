---
"tailwind-canonicalize": patch
---

Rewrite width utilities onto unique Tailwind v4 `--container-*` tokens when the computed length matches exactly (`min-w-112` → `min-w-md`, `min-w-144` → `min-w-xl`). Keep padding/height on the spacing scale. Regression coverage for rem arbitrary values (`min-w-[3.25rem]` → `min-w-13`).
