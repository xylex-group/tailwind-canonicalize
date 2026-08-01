# Prettier integration

[Prettier](https://prettier.io/) formats code style. It does not prove Tailwind theme equivalence.

If your repo still uses Prettier (instead of or alongside Biome), treat canonicalize as a **prior or subsequent** step — never as a Prettier plugin substitute.

## Scripts

```json
{
  "scripts": {
    "canonicalize": "tailwind-canonicalize . --write --safe",
    "format": "prettier --write .",
    "fix": "pnpm canonicalize && pnpm format",
    "check": "tailwind-canonicalize . --check && prettier --check ."
  }
}
```

## Order

```text
tailwind-canonicalize --write
→ prettier --write
```

Prettier may reflow multiline `className` templates; canonicalize is idempotent on token semantics.

## prettier-plugin-tailwindcss

The official Tailwind Prettier plugin **sorts** classes. That is complementary:

| Tool | Job |
|------|-----|
| tailwind-canonicalize | `w-[40px]` → `w-10` |
| prettier-plugin-tailwindcss | Order utilities in a class string |

Recommended:

```bash
pnpm exec tailwind-canonicalize . --write --safe
pnpm exec prettier --write .
```

Avoid any Prettier plugin that *converts* arbitrary values — that belongs here.

## lint-staged

```json
{
  "*.{js,jsx,ts,tsx,vue,html,mdx,css,md,json}": [
    "tailwind-canonicalize --write",
    "prettier --write"
  ]
}
```

Note: canonicalize only rewrites supported source extensions; Prettier can still format the rest. Split globs if you want:

```json
{
  "*.{js,jsx,ts,tsx,vue,astro,html,mdx}": [
    "tailwind-canonicalize --write",
    "prettier --write"
  ],
  "*.{css,md,json,yml}": [
    "prettier --write"
  ]
}
```

## Migrating from Prettier to Biome

1. Keep canonicalize scripts unchanged.  
2. Replace `prettier` scripts with Biome/Ultracite.  
3. Remove Prettier from lint-staged; follow [Biome guide](./biome.md).  

Canonicalize does not depend on either formatter.

## See also

- [Integrations overview](./integrations.md)
- [Biome](./biome.md)
