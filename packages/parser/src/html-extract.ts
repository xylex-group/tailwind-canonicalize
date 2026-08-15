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

type JsExtract = (src: string) => {
  occurrences: ClassOccurrence[];
  errors: ExtractError[];
};

function kindForAttr(attr: string): ClassOccurrence["kind"] {
  if (attr === "className") {
    return "className";
  }
  if (attr === "class:list") {
    return "clsx";
  }
  return "html-class";
}

/** Map `{...}` / quoted attribute values; expression forms need a JS walker. */
function extractWrappedExpression(
  inner: string,
  innerStart: number,
  extractJs: JsExtract,
  kind: ClassOccurrence["kind"],
): ClassOccurrence[] {
  // Wrap as a `cn(...)` call so the JS walker treats array/object/conditional
  // literals as class containers (same as `className={...}` / `clsx(...)`).
  const prefix = "cn(\n";
  const wrapped = `${prefix}${inner}\n);`;
  let js = extractJs(wrapped);
  let shift = prefix.length;
  if (js.occurrences.length === 0) {
    js = extractJs(`void (\n${inner}\n);`);
    shift = "void (\n".length;
  }
  if (js.occurrences.length === 0) {
    js = extractJs(inner);
    shift = 0;
  }
  const out: ClassOccurrence[] = [];
  for (const o of js.occurrences) {
    const localStart = o.start - shift;
    const localEnd = o.end - shift;
    if (localStart < 0 || localEnd > inner.length) {
      continue;
    }
    if (inner.slice(localStart, localEnd) !== o.raw) {
      continue;
    }
    out.push({
      ...o,
      start: localStart + innerStart,
      end: localEnd + innerStart,
      kind: o.kind === "unknown" ? kind : o.kind,
    });
  }
  return out;
}

function readBalanced(
  source: string,
  openIndex: number,
  open: string,
  close: string,
): { inner: string; innerStart: number; end: number } | null {
  if (source[openIndex] !== open) {
    return null;
  }
  let depth = 0;
  let quote: string | null = null;
  let escape = false;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i] ?? "";
    if (quote) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === open) {
      depth += 1;
      continue;
    }
    if (ch === close) {
      depth -= 1;
      if (depth === 0) {
        const innerStart = openIndex + 1;
        return {
          inner: source.slice(innerStart, i),
          innerStart,
          end: i + 1,
        };
      }
    }
  }
  return null;
}

export function extractFromHtml(
  source: string,
  extractJs?: JsExtract,
): { occurrences: ClassOccurrence[]; errors: ExtractError[] } {
  const occurrences: ClassOccurrence[] = [];
  const errors: ExtractError[] = [];

  // class / className / Astro class:list. Quoted values plus `{expr}` (JSX/Astro).
  const attrRe = /\b(className|class:list|class)\s*=\s*/g;

  let match: RegExpExecArray | null = attrRe.exec(source);
  while (match) {
    const attr = match[1] ?? "class";
    const valueStart = (match.index ?? 0) + match[0].length;
    const head = source[valueStart];
    if (head === '"' || head === "'") {
      const close = source.indexOf(head, valueStart + 1);
      if (close === -1) {
        match = attrRe.exec(source);
        continue;
      }
      const start = valueStart + 1;
      occurrences.push({
        raw: source.slice(start, close),
        start,
        end: close,
        kind: kindForAttr(attr),
      });
      attrRe.lastIndex = close + 1;
    } else if (head === "{") {
      const braced = readBalanced(source, valueStart, "{", "}");
      if (!braced) {
        match = attrRe.exec(source);
        continue;
      }
      const trimmed = braced.inner.trim();
      const quote = trimmed[0];
      const isQuoted =
        (quote === '"' || quote === "'" || quote === "`") &&
        trimmed.endsWith(quote) &&
        trimmed.length >= 2 &&
        !trimmed.slice(1, -1).includes(quote);
      if (isQuoted && quote) {
        const innerStart = braced.innerStart + braced.inner.indexOf(trimmed) + 1;
        const innerEnd = innerStart + trimmed.length - 2;
        occurrences.push({
          raw: source.slice(innerStart, innerEnd),
          start: innerStart,
          end: innerEnd,
          kind: kindForAttr(attr),
        });
      } else if (extractJs) {
        occurrences.push(
          ...extractWrappedExpression(braced.inner, braced.innerStart, extractJs, kindForAttr(attr)),
        );
      }
      attrRe.lastIndex = braced.end;
    }
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

function looksLikeJsxIsland(src: string): boolean {
  const t = src.trim();
  if (!t || t.length < 8) {
    return false;
  }
  return (
    t.includes("<") ||
    t.includes("className") ||
    t.includes("class:list") ||
    /\bclass\s*=/.test(t) ||
    /\b(clsx|cn|cva|twMerge|classnames|tv|cx)\s*\(/.test(t)
  );
}

function skipRanges(source: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const re = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
  let m: RegExpExecArray | null = re.exec(source);
  while (m) {
    ranges.push([m.index ?? 0, (m.index ?? 0) + m[0].length]);
    m = re.exec(source);
  }
  return ranges;
}

function inRange(index: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([a, b]) => index >= a && index < b);
}

function extractAstroExpressionIslands(
  markup: string,
  markupOffset: number,
  extractJs: (
    src: string,
    baseOffset: number,
  ) => { occurrences: ClassOccurrence[]; errors: ExtractError[] },
  out: ClassOccurrence[],
): void {
  const skips = skipRanges(markup);
  let i = 0;
  while (i < markup.length) {
    if (inRange(i, skips)) {
      i += 1;
      continue;
    }
    if (markup[i] !== "{") {
      i += 1;
      continue;
    }
    const braced = readBalanced(markup, i, "{", "}");
    if (!braced) {
      i += 1;
      continue;
    }
    if (looksLikeJsxIsland(braced.inner)) {
      const found = extractWrappedExpression(
        braced.inner,
        braced.innerStart + markupOffset,
        (src) => extractJs(src, 0),
        "clsx",
      );
      out.push(...found);
    }
    i = braced.end;
  }
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
    // Attribute scan on markup (class, className, class:list, `{expr}`)
    const html = extractFromHtml(markup, extractJs);
    for (const o of html.occurrences) {
      occurrences.push({
        ...o,
        start: o.start + markupOffset,
        end: o.end + markupOffset,
      });
    }
    // JSX-like `{ ... }` islands in Astro templates (map callbacks, fragments)
    extractAstroExpressionIslands(markup, markupOffset, extractJs, occurrences);
    // Also scan full source for className/class in case fm regex missed
    if (html.occurrences.length === 0) {
      const fullHtml = extractFromHtml(source, extractJs);
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
