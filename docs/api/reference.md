# API reference

Package entry: **`tailwind-canonicalize`** (the sole published npm package). The CLI re-exports in-repo compiler orchestration; `@tailwind-canonicalize/compiler` is not an npm package.

## `findCanonicalEquivalent(token, options?)`

Returns `{ canonical, canonicalBase, reason, matchedCandidates }` or `null`.

## `canonicalizeClass(token, options?)`

Returns the canonical token, or the original when no safe match exists.

## `canonicalizeClasses(tokens, options?)`

Maps `canonicalizeClass` over an array.

## `canonicalizeSource(source, options?)`

Extracts class strings, rewrites, returns `{ original, code, changed, rewrites, map }`.

## `canonicalizeFile(filePath, options?)`

Reads a file, optionally writes (`write: true`).

## `canonicalizeProject(options?)`

Scans paths in parallel. Options:

| Option | Default | Description |
|--------|---------|-------------|
| `paths` | `['.']` | Files or directories |
| `write` | `false` | Persist changes |
| `autoTheme` | `true` | Load project CSS theme |
| `concurrency` | `8` | Worker count |
| `rootFontSizePx` | `16` | rem conversion base |
| `ignore` | — | Extra ignore names |

Returns `ProjectSummary`.

## `loadThemeFromCss(css)` / `loadThemeFromProject(cwd)`

Theme discovery helpers.

## Options shared with resolver

```ts
interface FindCanonicalOptions {
  theme?: Theme;
  rootFontSizePx?: number;
  allowAmbiguous?: boolean;
  cache?: Map<string, CanonicalMatch | null>;
  compileEqual?: (a: string, b: string) => boolean | Promise<boolean>;
}
```
