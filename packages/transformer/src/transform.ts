import {
  extractClassOccurrences,
  type ExtractOptions,
} from "@tailwind-canonicalize/parser";
import { transformClassString } from "@tailwind-canonicalize/resolver";
import MagicString from "magic-string";
import type { Rewrite, TransformOptions, TransformResult } from "./types.js";

/**
 * Extract class strings, run multi-category pipeline, rewrite with MagicString.
 */
export function transformSource(
  source: string,
  options: TransformOptions = {},
): TransformResult {
  const extractOptions: ExtractOptions = {
    filePath: options.filePath,
  };
  const { occurrences } = extractClassOccurrences(source, extractOptions);
  const rewrites: Rewrite[] = [];
  const allTransformations: TransformResult["transformations"] = [];
  const allDiagnostics: TransformResult["diagnostics"] = [];
  const ms = new MagicString(source);

  const sorted = [...occurrences].sort((a, b) => b.start - a.start);

  for (const occurrence of sorted) {
    if (!occurrence.raw || !occurrence.raw.trim()) {
      continue;
    }
    if (occurrence.hasInterpolation && !hasClassTokens(occurrence.raw)) {
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
      rewrites.push({
        from: occurrence.raw,
        to: pipeline.result,
        start: occurrence.start,
        end: occurrence.end,
        occurrence,
        transformations: pipeline.transformations,
      });
      if (!options.dryRun) {
        ms.overwrite(occurrence.start, occurrence.end, pipeline.result);
      }
    }

    // Attach file location to transformations
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
  const code = options.dryRun || !changed ? source : ms.toString();

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
  };
}

function hasClassTokens(raw: string): boolean {
  return raw.split(/\s+/).some((t) => t.length > 0 && !t.includes("${"));
}

function offsetToLineCol(
  source: string,
  offset: number,
): { line: number; column: number } {
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
