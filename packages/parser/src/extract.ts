import { extractFromHtml, extractFromMdx, extractFromSfc } from "./html-extract.js";
import { extractFromJavaScript } from "./js-extract.js";
import type { ExtractOptions, ExtractResult } from "./types.js";
import { extensionOf, isJsLike } from "./utils.js";

/**
 * Extract all class-string occurrences from a source file.
 *
 * Uses a real JS/TS AST (oxc) for script-like files. Markup-oriented formats
 * use structured HTML attribute extraction plus script-block AST walks.
 * MDX is never full-file oxc-parsed (markdown is not TSX).
 */
export function extractClassOccurrences(
  source: string,
  options: ExtractOptions = {},
): ExtractResult {
  const ext = extensionOf(options.filePath);

  if (ext === ".mdx") {
    const result = extractFromMdx(source, (src) =>
      extractFromJavaScript(src, { ...options, filePath: "island.tsx" }),
    );
    return { ...result, language: "mdx" };
  }

  if (ext === ".vue") {
    const result = extractFromSfc(source, "vue", (src) =>
      extractFromJavaScript(src, { ...options, filePath: "block.tsx" }),
    );
    return { ...result, language: "vue" };
  }

  if (ext === ".svelte") {
    const result = extractFromSfc(source, "svelte", (src) =>
      extractFromJavaScript(src, { ...options, filePath: "block.tsx" }),
    );
    return { ...result, language: "svelte" };
  }

  if (ext === ".astro") {
    const result = extractFromSfc(source, "astro", (src) =>
      extractFromJavaScript(src, { ...options, filePath: "block.tsx" }),
    );
    return { ...result, language: "astro" };
  }

  if (ext === ".html") {
    const result = extractFromHtml(source);
    return { ...result, language: "html" };
  }

  if (isJsLike(ext) || !options.filePath) {
    const result = extractFromJavaScript(source, options);
    return {
      ...result,
      language: "javascript",
    };
  }

  // Fallback: try JS parse then HTML
  const js = extractFromJavaScript(source, { ...options, filePath: "file.tsx" });
  if (js.occurrences.length > 0 && js.errors.length === 0) {
    return { ...js, language: "unknown" };
  }
  const html = extractFromHtml(source);
  if (html.occurrences.length > 0) {
    return { ...html, language: "unknown" };
  }
  return { ...js, language: "unknown" };
}
