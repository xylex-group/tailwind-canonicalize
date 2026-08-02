import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createDefaultTheme } from "./default-theme.js";
import { parseLength, resolveSpacingMultiplier } from "./length.js";
import type { Theme, ThemeScale } from "./types.js";

const CONFIG_CANDIDATES = [
  "tailwind.config.ts",
  "tailwind.config.mts",
  "tailwind.config.js",
  "tailwind.config.mjs",
  "tailwind.config.cjs",
  "tailwind.config.cts",
];

/**
 * Load Tailwind v3 `tailwind.config.*` theme into our Theme model.
 * Supports CommonJS/ESM default export with `theme` / `theme.extend`.
 */
export async function loadThemeFromV3Config(
  cwd: string,
  configPath?: string,
): Promise<{ theme: Theme; configPath: string | null }> {
  const resolved = configPath
    ? path.isAbsolute(configPath)
      ? configPath
      : path.join(cwd, configPath)
    : await findConfig(cwd);

  if (!resolved) {
    return { theme: createDefaultTheme(), configPath: null };
  }

  let config: Record<string, unknown> = {};
  try {
    // Prefer dynamic import (works for ESM and some CJS)
    const href = pathToFileURL(resolved).href;
    const mod = await import(`${href}?t=${Date.now()}`);
    config = (mod.default ?? mod) as Record<string, unknown>;
  } catch {
    // Fallback: parse as JSON-like or require via createRequire for .cjs
    try {
      const { createRequire } = await import("node:module");
      const require = createRequire(import.meta.url);
      // Clear cache for watch mode
      try {
        delete require.cache[require.resolve(resolved)];
      } catch {
        // ignore
      }
      config = require(resolved) as Record<string, unknown>;
    } catch {
      // Last resort: extract theme from source text heuristically
      const src = await readFile(resolved, "utf8");
      config = extractThemeFromSource(src);
    }
  }

  const theme = mergeV3Config(createDefaultTheme(), config);
  return { theme, configPath: resolved };
}

async function findConfig(cwd: string): Promise<string | null> {
  for (const name of CONFIG_CANDIDATES) {
    const full = path.join(cwd, name);
    try {
      await access(full);
      return full;
    } catch {
      // continue
    }
  }
  return null;
}

function mergeV3Config(base: Theme, config: Record<string, unknown>): Theme {
  const themeBlock = (config.theme ?? {}) as Record<string, unknown>;
  const extend = (themeBlock.extend ?? {}) as Record<string, unknown>;

  // Merge order: base → theme (replace section) → extend (add)
  applySection(base.colors, themeBlock.colors as Record<string, unknown> | undefined, true);
  applySection(base.colors, extend.colors as Record<string, unknown> | undefined, false);

  applySection(base.spacing, themeBlock.spacing as Record<string, unknown> | undefined, true);
  applySection(base.spacing, extend.spacing as Record<string, unknown> | undefined, false);

  applySection(
    base.borderRadius,
    themeBlock.borderRadius as Record<string, unknown> | undefined,
    true,
  );
  applySection(
    base.borderRadius,
    extend.borderRadius as Record<string, unknown> | undefined,
    false,
  );

  applySection(
    base.borderWidth,
    themeBlock.borderWidth as Record<string, unknown> | undefined,
    true,
  );
  applySection(
    base.borderWidth,
    extend.borderWidth as Record<string, unknown> | undefined,
    false,
  );

  applySection(base.fontSize, flattenFontSize(themeBlock.fontSize), true);
  applySection(base.fontSize, flattenFontSize(extend.fontSize), false);

  applySection(
    base.lineHeight,
    themeBlock.lineHeight as Record<string, unknown> | undefined,
    true,
  );
  applySection(
    base.lineHeight,
    extend.lineHeight as Record<string, unknown> | undefined,
    false,
  );

  applySection(
    base.letterSpacing,
    themeBlock.letterSpacing as Record<string, unknown> | undefined,
    true,
  );
  applySection(
    base.letterSpacing,
    extend.letterSpacing as Record<string, unknown> | undefined,
    false,
  );

  applySection(base.boxShadow, themeBlock.boxShadow as Record<string, unknown> | undefined, true);
  applySection(base.boxShadow, extend.boxShadow as Record<string, unknown> | undefined, false);

  applySection(base.opacity, themeBlock.opacity as Record<string, unknown> | undefined, true);
  applySection(base.opacity, extend.opacity as Record<string, unknown> | undefined, false);

  // Sync width/height from spacing
  base.width = { values: new Map(base.spacing.values) };
  base.height = { values: new Map(base.spacing.values) };

  // Rebuild numeric spacing if custom spacing unit-like keys present
  const spacing0 = base.spacing.values.get("1");
  if (spacing0) {
    const unit = parseLength(spacing0);
    if (unit && unit.value > 0) {
      // spacing "1" in v3 is often 0.25rem — detect unit from key 1
      base.spacingUnit = unit;
    }
  }

  base.source = "merged";
  base.tailwindVersion = 3;
  return base;
}

function applySection(
  scale: ThemeScale,
  section: Record<string, unknown> | undefined,
  replace: boolean,
): void {
  if (!section || typeof section !== "object") {
    return;
  }
  if (replace) {
    // v3 full theme.colors replaces defaults for keys provided; we merge flat
  }
  flattenColorish(section, "", scale);
}

function flattenColorish(
  obj: Record<string, unknown>,
  prefix: string,
  scale: ThemeScale,
): void {
  for (const [key, value] of Object.entries(obj)) {
    const name = prefix ? `${prefix}-${key}` : key;
    if (typeof value === "string") {
      const k = key === "DEFAULT" && prefix ? prefix : name;
      scale.values.set(k === "DEFAULT" ? "DEFAULT" : k.replace(/^-/, ""), value);
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      // nested palette: blue: { 500: '...' }
      flattenColorish(value as Record<string, unknown>, name, scale);
    }
  }
}

function flattenFontSize(
  section: unknown,
): Record<string, unknown> | undefined {
  if (!section || typeof section !== "object") {
    return undefined;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(section as Record<string, unknown>)) {
    if (typeof v === "string") {
      out[k] = v;
    } else if (Array.isArray(v) && typeof v[0] === "string") {
      out[k] = v[0];
    } else if (v && typeof v === "object" && "fontSize" in (v as object)) {
      // ignore
    }
  }
  return out;
}

/**
 * Best-effort extract of theme colors from config source when import fails.
 */
function extractThemeFromSource(src: string): Record<string, unknown> {
  // Very small subset: colors: { brand: '#ff0000' }
  const colors: Record<string, string> = {};
  const colorBlock = src.match(/colors\s*:\s*\{([\s\S]*?)\}/);
  if (colorBlock?.[1]) {
    const re = /['"]?([a-zA-Z0-9-_]+)['"]?\s*:\s*['"]([^'"]+)['"]/g;
    let m: RegExpExecArray | null = re.exec(colorBlock[1]);
    while (m) {
      colors[m[1]!] = m[2]!;
      m = re.exec(colorBlock[1]);
    }
  }
  return { theme: { extend: { colors } } };
}

/**
 * Combined project theme load: prefer CSS @theme (v4), else v3 config.
 */
export async function loadProjectTheme(cwd: string): Promise<{
  theme: Theme;
  source: "css" | "v3-config" | "default";
  path: string | null;
}> {
  const { loadThemeFromProject } = await import("./load-theme.js");
  const css = await loadThemeFromProject(cwd);
  if (css.cssPath) {
    return { theme: css.theme, source: "css", path: css.cssPath };
  }
  const v3 = await loadThemeFromV3Config(cwd);
  if (v3.configPath) {
    return { theme: v3.theme, source: "v3-config", path: v3.configPath };
  }
  return { theme: createDefaultTheme(), source: "default", path: null };
}

// silence unused import used for potential rebuild
void resolveSpacingMultiplier;
