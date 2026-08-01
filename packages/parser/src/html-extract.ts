import type { ClassOccurrence, ExtractError } from "./types.js";

/**
 * Extract `class` / `className` attribute values from HTML-like markup.
 *
 * Uses a small state-machine tokenizer over attributes rather than a full HTML
 * DOM, so broken markup still yields safe partial results.
 */
/** True for ld+json / importmap / etc. — not class-string sources. */
function isNonJsScript(attrs: string): boolean {
  const type = /\btype\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]?.toLowerCase();
  if (!type) {
    return false;
  }
  if (
    type.includes("json") ||
    type.includes("importmap") ||
    type === "text/html" ||
    type.includes("template")
  ) {
    return true;
  }
  // Explicit non-JS MIME
  if (!type.includes("javascript") && !type.includes("ecmascript") && type !== "module" && !type.includes("typescript")) {
    // type="ts" / "text/typescript" handled above via typescript
    if (type === "ts" || type === "tsx" || type === "jsx") {
      return false;
    }
    return true;
  }
  return false;
}

/**
 * Heuristic: worth feeding to oxc as a module. Reject bare expression fragments
 * that commonly trigger "return outside function" in Astro/Vue islands.
 */
function looksLikeScriptModule(src: string): boolean {
  const t = src.trim();
  if (!t) {
    return false;
  }
  // JSON-like
  if (t.startsWith("{") && t.endsWith("}") && !t.includes("import") && !t.includes("export") && !t.includes("const ") && !t.includes("let ") && !t.includes("function")) {
    return false;
  }
  return (
    /\b(import|export|const|let|var|function|class|async|await|interface|type)\b/.test(t) ||
    t.includes("className") ||
    /class\s*=/.test(t) ||
    /\b(clsx|cn|cva|twMerge)\s*\(/.test(t)
  );
}

export function extractFromHtml(
  source: string,
): { occurrences: ClassOccurrence[]; errors: ExtractError[] } {
  const occurrences: ClassOccurrence[] = [];
  const errors: ExtractError[] = [];

  // Match class / className attributes with "..." or '...' values.
  // Does not cross into script content via naive global scan — callers should
  // pass only template/markup regions for Vue/Svelte/Astro when possible.
  const attrRe =
    /\b(className|class)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\}|\{"([^"]*)"\}|\{'([^']*)'\})/g;

  let match: RegExpExecArray | null = attrRe.exec(source);
  while (match) {
    const full = match[0];
    const attr = match[1] ?? "class";
    const value =
      match[2] ?? match[3] ?? match[4] ?? match[5] ?? match[6] ?? "";
    const valueIndexInFull = full.lastIndexOf(value);
    if (valueIndexInFull === -1) {
      match = attrRe.exec(source);
      continue;
    }
    const start = (match.index ?? 0) + valueIndexInFull;
    const end = start + value.length;
    occurrences.push({
      raw: value,
      start,
      end,
      kind: attr === "className" ? "className" : "html-class",
    });
    match = attrRe.exec(source);
  }

  return { occurrences, errors };
}

/**
 * MDX is not valid TSX — oxc floods "Cannot assign to this expression" on
 * markdown. Extract className/class attributes (JSX-in-MDX) plus fenced
 * ```tsx / ```jsx islands parsed as real JS when possible.
 */
export function extractFromMdx(
  source: string,
  extractJs: (
    src: string,
  ) => { occurrences: ClassOccurrence[]; errors: ExtractError[] },
): { occurrences: ClassOccurrence[]; errors: ExtractError[] } {
  const occurrences: ClassOccurrence[] = [];
  const errors: ExtractError[] = [];

  // 1) Attribute scan on full document (frontmatter + markdown + JSX tags)
  const html = extractFromHtml(source);
  occurrences.push(...html.occurrences);

  // 2) Fenced code islands that are real TSX/JSX (docs often embed examples)
  const fenceRe = /```(?:tsx|jsx|ts|js|javascript|typescript)\r?\n([\s\S]*?)```/gi;
  let fence: RegExpExecArray | null = fenceRe.exec(source);
  while (fence) {
    const inner = fence[1] ?? "";
    const innerStart = (fence.index ?? 0) + fence[0].indexOf(inner);
    const js = extractJs(inner);
    for (const o of js.occurrences) {
      occurrences.push({
        ...o,
        start: o.start + innerStart,
        end: o.end + innerStart,
      });
    }
    // Do not propagate fence parse errors to the host MDX file — example
    // snippets are often incomplete (missing imports) by design.
    fence = fenceRe.exec(source);
  }

  // Deduplicate spans
  const seen = new Set<string>();
  const unique = occurrences.filter((o) => {
    const key = `${o.start}:${o.end}:${o.raw}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  return { occurrences: unique, errors };
}

/**
 * Split Vue / Svelte / Astro SFCs into markup and script regions, then extract.
 */
export function extractFromSfc(
  source: string,
  kind: "vue" | "svelte" | "astro",
  extractJs: (
    src: string,
    baseOffset: number,
  ) => { occurrences: ClassOccurrence[]; errors: ExtractError[] },
): { occurrences: ClassOccurrence[]; errors: ExtractError[] } {
  const occurrences: ClassOccurrence[] = [];
  const errors: ExtractError[] = [];

  // Template / markup
  if (kind === "vue") {
    const templateRe = /<template\b[^>]*>([\s\S]*?)<\/template>/gi;
    let m: RegExpExecArray | null = templateRe.exec(source);
    while (m) {
      const inner = m[1] ?? "";
      const innerStart = (m.index ?? 0) + m[0].indexOf(inner);
      const html = extractFromHtml(inner);
      for (const o of html.occurrences) {
        occurrences.push({
          ...o,
          start: o.start + innerStart,
          end: o.end + innerStart,
        });
      }
      errors.push(...html.errors);
      m = templateRe.exec(source);
    }
  } else if (kind === "svelte") {
    // Whole file is markup + script; extract class attrs from full source first
    // then scripts.
    const html = extractFromHtml(source);
    occurrences.push(...html.occurrences);
    errors.push(...html.errors);
  } else {
    // Astro: frontmatter --- ... --- then markup
    // Accept optional trailing newline after closing ---
    const fm = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    let markup = source;
    let markupOffset = 0;
    if (fm) {
      const fmBody = fm[1] ?? "";
      const fmStart = source.indexOf(fmBody);
      // Only AST-walk frontmatter that looks like a script module. Incomplete
      // snippets / expression-only bodies produce "return outside function".
      if (looksLikeScriptModule(fmBody)) {
        const js = extractJs(fmBody, fmStart);
        for (const o of js.occurrences) {
          occurrences.push({
            ...o,
            start: o.start + fmStart,
            end: o.end + fmStart,
          });
        }
        // Soft: never block markup rewrites on frontmatter parse noise
      }
      markup = source.slice(fm[0].length);
      markupOffset = fm[0].length;
    }
    // Attribute scan on markup (and full file as fallback for class outside fm)
    const html = extractFromHtml(markup);
    for (const o of html.occurrences) {
      occurrences.push({
        ...o,
        start: o.start + markupOffset,
        end: o.end + markupOffset,
      });
    }
    // Also scan full source for className/class in case fm regex missed
    if (html.occurrences.length === 0) {
      const fullHtml = extractFromHtml(source);
      occurrences.push(...fullHtml.occurrences);
    }
  }

  // Script blocks — skip non-JS types; never fail the whole SFC on script errors
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let sm: RegExpExecArray | null = scriptRe.exec(source);
  while (sm) {
    const attrs = sm[1] ?? "";
    const inner = sm[2] ?? "";
    if (isNonJsScript(attrs)) {
      sm = scriptRe.exec(source);
      continue;
    }
    if (!looksLikeScriptModule(inner) && !inner.includes("className") && !inner.includes("class=")) {
      sm = scriptRe.exec(source);
      continue;
    }
    const innerStart = (sm.index ?? 0) + sm[0].indexOf(inner);
    const js = extractJs(inner, innerStart);
    for (const o of js.occurrences) {
      occurrences.push({
        ...o,
        start: o.start + innerStart,
        end: o.end + innerStart,
      });
    }
    // Soft errors: SFC markup rewrites must not be blocked by a bad <script>
    sm = scriptRe.exec(source);
  }

  const seen = new Set<string>();
  const unique = occurrences.filter((o) => {
    const key = `${o.start}:${o.end}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  unique.sort((a, b) => a.start - b.start);
  return { occurrences: unique, errors };
}
