# ESLint integration (first-class)

[ESLint](https://eslint.org/) owns **lint rules** (bugs, style, framework policies).  
`tailwind-canonicalize` owns **semantic Tailwind rewrites**.

Do not use ESLint as a theme-equivalence engine. Compose them.

## Install

```bash
pnpm add -D tailwind-canonicalize eslint
# optional Tailwind class helpers (sorting / conflict detection only)
pnpm add -D eslint-plugin-tailwindcss
```

## Scripts

```json
{
  "scripts": {
    "canonicalize": "tailwind-canonicalize . --write --safe",
    "canonicalize:check": "tailwind-canonicalize . --check",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "fix": "pnpm canonicalize && pnpm lint:fix",
    "check": "pnpm canonicalize:check && pnpm lint"
  }
}
```

## Flat config (ESLint 9+)

Canonicalize is **not** an ESLint rule by default. Keep ESLint focused:

```js
// eslint.config.js
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/**", "node_modules/**", ".tailwind-canonicalize-cache.json"],
  },
);
```

### Optional: eslint-plugin-tailwindcss

Useful for **class order** and **invalid class names** — complementary, not a substitute:

```js
import tailwind from "eslint-plugin-tailwindcss";

export default [
  ...tailwind.configs["flat/recommended"],
  {
    settings: {
      tailwindcss: {
        callees: ["cn", "clsx", "cva", "twMerge"],
        config: "tailwind.config.js", // or CSS-first path tooling as supported
      },
    },
  },
];
```

**Disable** any rule that rewrites arbitrary values to spacing scales if you adopt canonicalize for that. Prefer:

| Concern | Tool |
|---------|------|
| `w-[40px]` → `w-10` | **tailwind-canonicalize** |
| Class sort order | eslint-plugin-tailwindcss / Prettier plugin |
| Conflicting utilities warning | eslint-plugin-tailwindcss |
| Migrations `bg-gradient-to-*` | **tailwind-canonicalize --migrate** |

## lint-staged

```json
{
  "*.{js,jsx,ts,tsx,mjs,cjs,vue}": [
    "tailwind-canonicalize --write",
    "eslint --fix --max-warnings=0"
  ]
}
```

## CI

```yaml
- run: pnpm exec tailwind-canonicalize . --check --json
- run: pnpm exec eslint .
```

## Thin “ESLint plugin” pattern (optional)

If you want failures to appear as ESLint results in the IDE without a separate CLI step, wrap the library in a custom rule (maintained in your monorepo):

```js
// tools/eslint-plugin-local/rules/tailwind-canonicalize.js
import { findCanonicalEquivalent, createDefaultTheme } from "tailwind-canonicalize";

const theme = createDefaultTheme();

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Prefer canonical Tailwind utilities" },
    fixable: "code",
    schema: [],
  },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value !== "string") return;
        // Minimal demo: single-token string literals only.
        // Prefer the CLI for multi-class / JSX extraction.
        const match = findCanonicalEquivalent(node.value.trim(), { theme });
        if (match && match.canonical !== node.value.trim()) {
          context.report({
            node,
            message: `Use '${match.canonical}' instead of '${node.value}'.`,
            fix(fixer) {
              return fixer.replaceText(node, JSON.stringify(match.canonical));
            },
          });
        }
      },
    };
  },
};
```

**Caveats:**

- JSX `className`, `clsx`, and multi-token strings need full AST walking — the **CLI already does this**.
- Theme loading (`@theme` / v3 config) should mirror CLI options; a naive rule will false-negative.
- Official recommendation: **CLI in CI/hooks**; custom rule only for light IDE hints.

## ESLint + Biome together

Some repos use Biome for format and ESLint for a few rules:

```text
canonicalize --write
→ biome check --write
→ eslint .          # no --fix if Biome owns format
```

Avoid dual formatters on the same files.

## Nx / Angular / Nest ESLint executors

```json
{
  "targets": {
    "canonicalize": {
      "command": "tailwind-canonicalize src --check",
      "options": { "cwd": "{projectRoot}" }
    },
    "lint": {
      "executor": "@nx/eslint:lint",
      "dependsOn": ["canonicalize"]
    }
  }
}
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| ESLint and canonicalize both “fix” class order | Disable one sorter |
| IDE shows no canonicalize diagnostics | Install VS Code extension or custom rule; CLI is source of truth for CI |
| `eslint --fix` reintroduces arbitraries | Nothing should; if a plugin does, remove that rule |

## See also

- [Integrations overview](./integrations.md)
- [Biome](./biome.md)
- [Oxlint](./oxlint.md)
