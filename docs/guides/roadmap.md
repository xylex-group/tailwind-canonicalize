# Roadmap

## Now (0.1–0.2)

- [x] Modular monorepo + CLI
- [x] oxc-based JS/TS extraction
- [x] Theme defaults + `@theme` CSS merge
- [x] Spacing / radius / text / keywords / fractions / variants / important
- [x] MagicString rewrites
- [x] Versioned Tailwind migration registry
- [x] Multi-category transformation pipeline
- [x] Duplicate utility collapse + conflict diagnostics
- [x] Two-phase semantic token analyze / apply
- [x] Token graph, alias cycles, duplicate-value reports
- [x] defineConfig + safety modes
- [x] Fixtures + unit/matrix tests
- [x] VS Code extension scaffold
- [x] GitHub Action scaffold

## Done (expanded)

- [x] Dark-pair collapse with approved dual-theme pairs
- [x] Semantic recipe multi-token apply (warning surfaces, etc.)
- [x] Dual-theme CSS generation (`:root` / `.dark` / `@theme inline`)
- [x] Aggressive opt-in for high-confidence inferred mappings
- [x] Idempotence tests per transformation category
- [x] Full default color palette table
- [x] Optional Tailwind v4 `compile()` strict comparator (`--strict-compile`)
- [x] Tailwind v3 `tailwind.config.*` loader (`loadThemeFromV3Config` / `loadProjectTheme`)
- [x] Incremental file hashing + watch mode (`--incremental` / `--watch`)
- [x] Worker-thread pool for huge monorepos (`--workers`)
- [x] Thousands of generated matrix fixture cases

## Later

- [ ] LSP server
- [ ] Biome / ESLint plugin wrappers (thin, optional)
- [ ] WASM browser playground
