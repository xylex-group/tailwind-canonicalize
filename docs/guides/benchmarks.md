# Benchmark methodology

```bash
pnpm benchmark
```

Measures:

1. **Token resolve** — `findCanonicalEquivalent` with cache (ops/sec)
2. **Class string rewrite** — multi-token strings
3. **File transform** — parse + rewrite of synthetic multi-line sources

## Principles

- Warm caches before measuring steady-state throughput
- Report wall-clock with `performance.now()`
- Cache compiled/normalized candidates per theme

Large monorepos should enable project-level theme load once, then fan out file workers (`concurrency`).
