# Editor integration

## VS Code

### Extension (`packages/vscode`)

The workspace extension provides:

1. **Hint diagnostics** on arbitrary utilities with a safe canonical form  
2. **Quick Fix**: “Convert to canonical Tailwind class `…`”  
3. Command palette: **Tailwind Canonicalize: Document**

Build locally:

```bash
pnpm --filter tailwind-canonicalize-vscode build
```

### With Biome (recommended)

```json
// .vscode/settings.json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports.biome": "explicit",
    "source.fixAll.biome": "explicit"
  }
}
```

Semantic rewrites: use the extension Quick Fix / Document command, or a pre-commit hook. Avoid stacking another formatter (Prettier) as default.

### With ESLint extension

- Enable ESLint for rule diagnostics.  
- Do **not** rely on ESLint alone for `w-[40px]` → `w-10` (use canonicalize CLI or a thin custom rule — see [eslint.md](./eslint.md)).  
- Code Actions on save: ESLint fix + Biome format is fine if Biome owns format only.

### With Oxlint

Oxlint IDE support is evolving; keep canonicalize diagnostics via the VS Code extension or CLI on save tasks.

### Format on save task (any stack)

```json
// .vscode/tasks.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "canonicalize current file",
      "type": "shell",
      "command": "pnpm exec tailwind-canonicalize ${file} --write --safe",
      "presentation": { "reveal": "silent" },
      "problemMatcher": []
    }
  ]
}
```

## JetBrains (WebStorm / IntelliJ)

- External tool: `pnpm exec tailwind-canonicalize $FilePath$ --write --safe`  
- File Watcher optional; prefer pre-commit to avoid save loops  
- Use Biome/ESLint plugins for non-Tailwind concerns  

## Neovim

```lua
-- run on save for TSX (example)
vim.api.nvim_create_autocmd("BufWritePost", {
  pattern = { "*.tsx", "*.jsx", "*.vue", "*.astro" },
  callback = function(args)
    vim.fn.jobstart({
      "pnpm", "exec", "tailwind-canonicalize", args.file, "--write", "--safe",
    }, { detach = true })
  end,
})
```

Prefer project hooks over global autocmd for team consistency.

## stdin mode

```bash
tailwind-canonicalize --stdin < Component.tsx > Component.out.tsx
```

Useful for custom editor bridges. Prefer path mode when possible (theme discovery uses project cwd).

## See also

- [Biome](./biome.md)
- [ESLint](./eslint.md)
- [Integrations](./integrations.md)
