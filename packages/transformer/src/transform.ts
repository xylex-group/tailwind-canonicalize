import { type ExtractOptions, extractClassOccurrences } from "@tailwind-canonicalize/parser";
import { transformClassString } from "@tailwind-canonicalize/resolver";
import MagicString from "magic-string";
import type { Rewrite, TransformOptions, TransformResult } from "./types.js";

/**
 * Extract class strings, run multi-category pipeline, rewrite with MagicString.
 *
 * Safety:
 * - Parse errors → no rewrites (report errors; leave source unchanged).
 * - Interpolated template quasis → only complete static utility tokens.
 * - Span content must match occurrence.raw before overwrite.
 */
export function transformSource(source: string, options: TransformOptions = {}): TransformResult {
  const extractOptions: ExtractOptions = {
    filePath: options.filePath,
  };
  const { occurrences, errors } = extractClassOccurrences(source, extractOptions);
  const rewrites: Rewrite[] = [];
  const allTransformations: TransformResult["transformations"] = [];
  const allDiagnostics: TransformResult["diagnostics"] = [];
  const ms = new MagicString(source);

  // Malformed / partially parsed source: never rewrite (safety contract).
  if (errors.length > 0) {
    return {
      original: source,
      code: source,
      changed: false,
      rewrites: [],
      transformations: [],
      diagnostics: errors.map((e) => ({
        kind: "info" as const,
        message: `parse error: ${e.message}`,
        utilities: [],
      })),
      map: null,
      parseErrors: errors.map((e) => e.message),
    };
  }

  const sorted = [...occurrences].sort((a, b) => b.start - a.start);

  for (const occurrence of sorted) {
    if (!occurrence.raw || !occurrence.raw.trim()) {
      continue;
    }

    // Prove span integrity before any mutation
    const slice = source.slice(occurrence.start, occurrence.end);
    if (slice !== occurrence.raw) {
      allDiagnostics.push({
        kind: "info",
        message: "Skipped rewrite: occurrence span does not match source slice (unsafe offset)",
        utilities: [],
      });
      continue;
    }

    // Interpolated templates: only rewrite complete static utilities.
    // Skip fragments that are partial class stems around ${...}.
    if (occurrence.hasInterpolation && !isSafeStaticQuasi(occurrence.raw)) {
      continue;
    }

    const pipeline = transformClassString(occurrence.raw, options);

    if (
      pipeline.transformations.length === 0 &&
      pipeline.diagnostics.length === 0 &&
      pipeline.result === occurrence.raw
    ) {
      continue;
    }

    if (pipeline.result !== occurrence.raw) {
      // Second check after pipeline — result must not expand beyond span safety
      rewrites.push({
        from: occurrence.raw,
        to: pipeline.result,
        start: occurrence.start,
        end: occurrence.end,
        occurrence,
        transformations: pipeline.transformations,
      });
      // Always compute the would-be source so --check --diff shows real hunks.
      // Disk writes are gated by canonicalizeFile(write), not dryRun here.
      ms.overwrite(occurrence.start, occurrence.end, pipeline.result);
    }

    const { line, column } = offsetToLineCol(source, occurrence.start);
    for (const t of pipeline.transformations) {
      allTransformations.push({
        ...t,
        file: options.filePath,
        line: t.line ?? line,
        column: t.column ?? column,
      });
    }
    allDiagnostics.push(...pipeline.diagnostics);
  }

  rewrites.sort((a, b) => a.start - b.start);

  const changed = rewrites.length > 0;
  const code = changed ? ms.toString() : source;

  let map: TransformResult["map"] = null;
  if (options.sourceMap && changed && !options.dryRun) {
    const generated = ms.generateMap({
      source: options.filePath ?? "file.tsx",
      includeContent: false,
      hires: true,
    });
    map = {
      mappings: generated.mappings,
      names: generated.names,
      sources: generated.sources,
      file: generated.file,
    };
  }

  return {
    original: source,
    code,
    changed,
    rewrites,
    transformations: allTransformations,
    diagnostics: allDiagnostics,
    map,
    parseErrors: [],
  };
}

/**
 * True when a template quasi is independently rewritable:
 * complete static class tokens only — no partial stems next to interpolations.
 *
 * Rejects:
 * - `text-${color}`  → quasi "text-"
 * - `bg-[${value}px]` → quasis "bg-[" and "px]"
 * - tokens containing `${`
 */
export function isSafeStaticQuasi(raw: string): boolean {
  if (!raw.trim()) {
    return false;
  }
  if (raw.includes("${")) {
    return false;
  }

  const trimmed = raw.trim();

  // Incomplete utility stem before an interpolation (ends with -, :, or open [)
  if (/[-:]$/.test(trimmed) || /\[[^\]]*$/.test(trimmed)) {
    return false;
  }

  // Incomplete continuation after interpolation (starts with ], unit, or slash)
  if (/^[\]]/.test(trimmed) || /^(px|rem|em|%|vh|vw|svh|dvh)\b/i.test(trimmed)) {
    return false;
  }

  // Must contain at least one complete token that looks like a utility
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return false;
  }

  // Every non-empty token must be a complete utility (no dangling brackets)
  for (const t of tokens) {
    if (t.includes("${")) {
      return false;
    }
    const opens = (t.match(/\[/g) ?? []).length;
    const closes = (t.match(/\]/g) ?? []).length;
    if (opens !== closes) {
      return false;
    }
  }

  return true;
}

function offsetToLineCol(source: string, offset: number): { line: number; column: number } {
  let line = 1;
  let column = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return { line, column };
}
