# Performance: incremental, workers, watch

## Incremental hashing

```bash
tailwind-canonicalize . --incremental --write
```

- Content hash per file (SHA-256 prefix) stored in `.tailwind-canonicalize-cache.json`
- Options hash invalidates the whole cache when pipeline config changes
- Skipped files reported as `filesSkipped` in JSON output

## Worker threads

```bash
tailwind-canonicalize . --workers --concurrency 16
```

- Auto-enabled when file count ≥ 32 (`workers: "auto"`)
- `--no-workers` forces main-thread pool
- Falls back to main thread if a worker fails
- Theme is serialized as plain maps for worker isolation

## Watch mode

```bash
tailwind-canonicalize . --watch --write
```

- Recursive `fs.watch` on configured paths
- 150ms debounce
- Always uses incremental cache
- Ctrl+C to stop

## Strict compile (optional)

```bash
pnpm add -D tailwindcss
tailwind-canonicalize . --strict-compile --write
```

Uses Tailwind’s programmatic `compile()` when available so candidates are only rewritten when generated CSS declarations match after normalization.
