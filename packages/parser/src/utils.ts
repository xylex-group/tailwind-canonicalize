import type { SupportedExtension } from "./types.js";

const JS_LIKE = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".mdx",
]);

export function extensionOf(filePath: string | undefined): string {
  if (!filePath) {
    return ".tsx";
  }
  const base = filePath.split(/[\\/]/).pop() ?? filePath;
  const idx = base.lastIndexOf(".");
  if (idx === -1) {
    return "";
  }
  return base.slice(idx).toLowerCase();
}

export function isJsLike(ext: string): boolean {
  return JS_LIKE.has(ext);
}

export function isSupportedExtension(ext: string): ext is SupportedExtension {
  return (
    JS_LIKE.has(ext) ||
    ext === ".html" ||
    ext === ".vue" ||
    ext === ".astro" ||
    ext === ".svelte"
  );
}

export function defaultClassFunctions(): string[] {
  return ["clsx", "cn", "classnames", "twMerge", "cva", "cx", "tv", "classNames"];
}

export function defaultTaggedTemplates(): string[] {
  return ["tw"];
}

/**
 * Split a class string into individual tokens while preserving significant structure.
 * Whitespace (including newlines) separates tokens; empty tokens are dropped.
 */
export function tokenizeClasses(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

/**
 * Rebuild a class string, preserving original leading/trailing whitespace and
 * multi-line indentation style when possible.
 */
export function rebuildClassString(original: string, tokens: string[]): string {
  if (tokens.length === 0) {
    return original.trim().length === 0 ? original : "";
  }

  const hasNewline = original.includes("\n");
  if (!hasNewline) {
    const leading = original.match(/^\s*/)?.[0] ?? "";
    const trailing = original.match(/\s*$/)?.[0] ?? "";
    return `${leading}${tokens.join(" ")}${trailing}`;
  }

  // Multi-line: keep indentation of the first non-empty line.
  const lines = original.split("\n");
  let indent = "  ";
  for (const line of lines) {
    const m = line.match(/^(\s+)\S/);
    if (m?.[1]) {
      indent = m[1];
      break;
    }
  }

  const leadingNewline = original.startsWith("\n") ? "\n" : "";
  const trailingNewline = original.endsWith("\n") ? "\n" : "";
  const body = tokens.map((t) => `${indent}${t}`).join("\n");
  return `${leadingNewline}${body}${trailingNewline}`;
}
