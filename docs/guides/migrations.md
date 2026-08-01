# Tailwind version migrations

Migrations live in a single registry:

`packages/resolver/src/migrations/registry.ts`

Each entry:

```ts
interface TailwindMigration {
  id: string;
  fromVersion: string;
  toVersion: string;
  deprecatedClass: string;
  canonicalClass: string;
  safety: "safe" | "review";
  notes?: string;
  removalDate?: string;
}
```

## CLI

```bash
tailwind-canonicalize . --migrate
tailwind-canonicalize . --from-tailwind 3 --to-tailwind 4 --write
tailwind-canonicalize . --migrations-only --write
```

## Example

```
hover:bg-gradient-to-br  →  hover:bg-linear-to-br
dark:md:bg-gradient-to-br → dark:md:bg-linear-to-br
bg-gradient-to-br!       →  bg-linear-to-br!
```

Variants and important flags are always preserved.
