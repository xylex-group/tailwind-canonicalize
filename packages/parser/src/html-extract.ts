import type { ClassOccurrence, ExtractError } from "./types.js";

/**
 * Extract `class` / `className` attribute values from HTML-like markup.
 *
 * Uses a small state-machine tokenizer over attributes rather than a full HTML
 * DOM, so broken markup still yields safe partial results.
 */
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
    const fm = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    let markup = source;
    let markupOffset = 0;
    if (fm) {
      const js = extractJs(fm[1] ?? "", 4); // after ---\n roughly; recompute
      const fmStart = source.indexOf(fm[1] ?? "");
      for (const o of js.occurrences) {
        occurrences.push({
          ...o,
          start: o.start + fmStart,
          end: o.end + fmStart,
        });
      }
      errors.push(...js.errors);
      markup = source.slice(fm[0].length);
      markupOffset = fm[0].length;
    }
    const html = extractFromHtml(markup);
    for (const o of html.occurrences) {
      occurrences.push({
        ...o,
        start: o.start + markupOffset,
        end: o.end + markupOffset,
      });
    }
    errors.push(...html.errors);
  }

  // Script blocks
  const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let sm: RegExpExecArray | null = scriptRe.exec(source);
  while (sm) {
    const inner = sm[1] ?? "";
    const innerStart = (sm.index ?? 0) + sm[0].indexOf(inner);
    const js = extractJs(inner, innerStart);
    for (const o of js.occurrences) {
      occurrences.push({
        ...o,
        start: o.start + innerStart,
        end: o.end + innerStart,
      });
    }
    errors.push(...js.errors);
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
