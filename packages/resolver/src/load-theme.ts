import { readFile } from "node:fs/promises";
import path from "node:path";
import { createDefaultTheme } from "./default-theme.js";
import { parseLength } from "./length.js";
import type { Theme, ThemeScale } from "./types.js";

/**
 * Parse `@theme { ... }` blocks and CSS custom properties into a Theme.
 * Merges onto the default theme so unspecified tokens remain available.
 */
export function loadThemeFromCss(css: string, base: Theme = createDefaultTheme()): Theme {
  const theme: Theme = {
    spacingUnit: base.spacingUnit,
    spacing: cloneScale(base.spacing),
    colors: cloneScale(base.colors),
    borderWidth: cloneScale(base.borderWidth),
    borderRadius: cloneScale(base.borderRadius),
    fontSize: cloneScale(base.fontSize),
    lineHeight: cloneScale(base.lineHeight),
    letterSpacing: cloneScale(base.letterSpacing),
    blur: cloneScale(base.blur),
    boxShadow: cloneScale(base.boxShadow),
    opacity: cloneScale(base.opacity),
    width: cloneScale(base.width),
    height: cloneScale(base.height),
    container: cloneScale(base.container),
    cssVariables: new Map(base.cssVariables),
    source: "merged",
    tailwindVersion: base.tailwindVersion ?? 4,
  };

  // Collect @theme blocks
  const themeBlocks = css.matchAll(/@theme(?:\s+[^{]*)?\{([\s\S]*?)\}/g);
  for (const block of themeBlocks) {
    applyThemeDeclarations(theme, block[1] ?? "");
  }

  // Also collect :root / bare custom props that look like theme tokens
  const varRe = /--([a-zA-Z0-9-_]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null = varRe.exec(css);
  while (m) {
    const name = `--${m[1]}`;
    const value = (m[2] ?? "").trim();
    theme.cssVariables.set(name, value);
    applyCssVariable(theme, name, value);
    m = varRe.exec(css);
  }

  const spacing = theme.cssVariables.get("--spacing");
  if (spacing) {
    theme.spacingUnit = parseLength(spacing);
    // Rebuild numeric spacing from unit when custom
    if (theme.spacingUnit) {
      // leave existing explicit keys; unit used by resolver for calc
    }
  }

  return theme;
}

function applyThemeDeclarations(theme: Theme, body: string): void {
  const declRe = /--([a-zA-Z0-9-_]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null = declRe.exec(body);
  while (m) {
    const name = `--${m[1]}`;
    const value = (m[2] ?? "").trim();
    theme.cssVariables.set(name, value);
    applyCssVariable(theme, name, value);
    m = declRe.exec(body);
  }
}

function applyCssVariable(theme: Theme, name: string, value: string): void {
  // --spacing
  if (name === "--spacing") {
    theme.spacingUnit = parseLength(value);
    return;
  }

  // --color-*
  const color = name.match(/^--color-(.+)$/);
  if (color?.[1]) {
    theme.colors.values.set(color[1], value);
    return;
  }

  // --radius-* / --border-radius-*
  const radius = name.match(/^--(?:radius|border-radius)-(.+)$/);
  if (radius?.[1]) {
    const key = radius[1] === "DEFAULT" ? "DEFAULT" : radius[1];
    theme.borderRadius.values.set(key, value);
    return;
  }

  // --border-width-* / --border-width (DEFAULT)
  const borderW = name.match(/^--border-width(?:-(.+))?$/);
  if (borderW) {
    const key = borderW[1] && borderW[1].length > 0 ? borderW[1] : "DEFAULT";
    theme.borderWidth.values.set(key, value);
    return;
  }

  // --text-* font sizes
  const text = name.match(/^--text-(.+)$/);
  if (text?.[1] && !text[1].includes("line-height") && !text[1].includes("--")) {
    theme.fontSize.values.set(text[1], value);
    return;
  }

  // --leading-*
  const leading = name.match(/^--leading-(.+)$/);
  if (leading?.[1]) {
    theme.lineHeight.values.set(leading[1], value);
    return;
  }

  // --tracking-*
  const tracking = name.match(/^--tracking-(.+)$/);
  if (tracking?.[1]) {
    theme.letterSpacing.values.set(tracking[1], value);
    return;
  }

  // --blur-*
  const blur = name.match(/^--blur-(.+)$/);
  if (blur?.[1]) {
    theme.blur.values.set(blur[1], value);
    return;
  }

  // --shadow-*
  const shadow = name.match(/^--shadow-(.+)$/);
  if (shadow?.[1]) {
    theme.boxShadow.values.set(shadow[1], value);
    return;
  }

  // --container-* (min-w-md, max-w-xl, …)
  const container = name.match(/^--container-(.+)$/);
  if (container?.[1]) {
    theme.container.values.set(container[1], value);
    return;
  }

  // --spacing-* explicit spacing keys (v3-style leftover)
  const spacing = name.match(/^--spacing-(.+)$/);
  if (spacing?.[1]) {
    theme.spacing.values.set(spacing[1], value);
    theme.width.values.set(spacing[1], value);
    theme.height.values.set(spacing[1], value);
  }
}

function cloneScale(scale: ThemeScale): ThemeScale {
  return { values: new Map(scale.values) };
}

/**
 * Discover and load theme CSS from a project directory.
 * Looks for common Tailwind entry files.
 */
export async function loadThemeFromProject(
  cwd: string,
): Promise<{ theme: Theme; cssPath: string | null }> {
  const candidates = [
    "src/index.css",
    "src/styles.css",
    "src/app.css",
    "src/global.css",
    "src/globals.css",
    "app/globals.css",
    "styles/globals.css",
    "styles/index.css",
    "app.css",
    "index.css",
    "global.css",
  ];

  for (const rel of candidates) {
    const full = path.join(cwd, rel);
    try {
      const css = await readFile(full, "utf8");
      if (
        css.includes("@import") && css.includes("tailwind") ||
        css.includes("@theme") ||
        css.includes("@tailwind")
      ) {
        return { theme: loadThemeFromCss(css), cssPath: full };
      }
    } catch {
      // continue
    }
  }

  return { theme: createDefaultTheme(), cssPath: null };
}
