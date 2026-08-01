import { parseSync } from "oxc-parser";
import type { ClassOccurrence, ExtractError, ExtractOptions } from "./types.js";
import { defaultClassFunctions, defaultTaggedTemplates, extensionOf } from "./utils.js";

type Span = { start: number; end: number };

interface WalkerContext {
  source: string;
  occurrences: ClassOccurrence[];
  classFunctions: Set<string>;
  taggedTemplates: Set<string>;
  errors: ExtractError[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(node: unknown, key: string): string | undefined {
  if (!isRecord(node)) {
    return undefined;
  }
  const v = node[key];
  return typeof v === "string" ? v : undefined;
}

function getNode(node: unknown, key: string): unknown {
  if (!isRecord(node)) {
    return undefined;
  }
  return node[key];
}

function getArray(node: unknown, key: string): unknown[] {
  if (!isRecord(node)) {
    return [];
  }
  const v = node[key];
  return Array.isArray(v) ? v : [];
}

function spanOf(node: unknown): Span | null {
  if (!isRecord(node)) {
    return null;
  }
  const start = node.start;
  const end = node.end;
  if (typeof start === "number" && typeof end === "number") {
    return { start, end };
  }
  return null;
}

function pushLiteral(
  ctx: WalkerContext,
  node: unknown,
  kind: ClassOccurrence["kind"],
): void {
  if (!isRecord(node)) {
    return;
  }
  const type = getString(node, "type");
  if (type === "Literal" || type === "StringLiteral") {
    const value = node.value;
    if (typeof value !== "string") {
      return;
    }
    const span = spanOf(node);
    if (!span) {
      return;
    }
    // Skip quote characters for rewrite targets.
    const raw = ctx.source.slice(span.start, span.end);
    const quote = raw[0];
    const quoted =
      (quote === '"' || quote === "'" || quote === "`") && raw.endsWith(quote);
    const start = quoted ? span.start + 1 : span.start;
    const end = quoted ? span.end - 1 : span.end;
    ctx.occurrences.push({
      raw: ctx.source.slice(start, end),
      start,
      end,
      kind,
    });
    return;
  }

  if (type === "TemplateLiteral") {
    pushTemplate(ctx, node, kind);
  }
}

function pushTemplate(
  ctx: WalkerContext,
  node: Record<string, unknown>,
  kind: ClassOccurrence["kind"],
): void {
  const quasis = getArray(node, "quasis");
  const expressions = getArray(node, "expressions");
  const hasInterpolation = expressions.length > 0;

  // Only rewrite quasi segments that are pure static class text regions.
  // Each quasi is rewritten independently; expressions stay untouched.
  for (const quasi of quasis) {
    if (!isRecord(quasi)) {
      continue;
    }
    const value = getNode(quasi, "value");
    const cooked =
      isRecord(value) && typeof value.cooked === "string"
        ? value.cooked
        : isRecord(value) && typeof value.raw === "string"
          ? value.raw
          : undefined;
    if (cooked === undefined) {
      continue;
    }
    const span = spanOf(quasi);
    if (!span) {
      continue;
    }
    // TemplateElement spans can include backticks / ${} delimiters depending on
    // engine. Only rewrite when we can prove the span maps to `cooked` content.
    const resolved = resolveTemplateQuasiSpan(ctx.source, span, cooked);
    if (!resolved) {
      continue;
    }
    ctx.occurrences.push({
      raw: cooked,
      start: resolved.start,
      end: resolved.end,
      kind,
      isTemplate: true,
      hasInterpolation,
    });
  }
}

/**
 * Map a TemplateElement span to the exact cooked content range in source.
 * Returns null when the slice cannot be validated (unsafe to overwrite).
 */
function resolveTemplateQuasiSpan(
  source: string,
  span: Span,
  cooked: string,
): Span | null {
  if (cooked.length === 0) {
    // Empty quasi between ${} — nothing to rewrite; skip safely.
    return null;
  }

  const direct = source.slice(span.start, span.end);
  if (direct === cooked) {
    return span;
  }

  // Span may include a leading/trailing backtick or ${ / } delimiters.
  // Search for an exact cooked match inside the span (and ±2 for edge noise).
  const lo = Math.max(0, span.start - 2);
  const hi = Math.min(source.length, span.end + 2);
  const window = source.slice(lo, hi);
  const idx = window.indexOf(cooked);
  if (idx === -1) {
    return null;
  }
  // Prefer the match that sits closest to span.start
  let best = idx;
  let next = window.indexOf(cooked, idx + 1);
  while (next !== -1) {
    const curDist = Math.abs(lo + best - span.start);
    const nextDist = Math.abs(lo + next - span.start);
    if (nextDist < curDist) {
      best = next;
    }
    next = window.indexOf(cooked, next + 1);
  }
  const start = lo + best;
  const end = start + cooked.length;
  if (source.slice(start, end) !== cooked) {
    return null;
  }
  // Refuse if the match would overwrite template delimiters exclusively
  // without equaling cooked (already checked). Also refuse when cooked itself
  // contains backticks that would imply multi-literal confusion.
  if (cooked.includes("`")) {
    return null;
  }
  return { start, end };
}

function calleeName(node: unknown): string | null {
  if (!isRecord(node)) {
    return null;
  }
  const type = getString(node, "type");
  if (type === "Identifier") {
    return getString(node, "name") ?? null;
  }
  if (type === "MemberExpression") {
    const prop = getNode(node, "property");
    if (isRecord(prop) && getString(prop, "type") === "Identifier") {
      return getString(prop, "name") ?? null;
    }
  }
  return null;
}

function walkExpr(ctx: WalkerContext, node: unknown, kind: ClassOccurrence["kind"]): void {
  if (!isRecord(node)) {
    return;
  }
  const type = getString(node, "type");
  if (!type) {
    return;
  }

  switch (type) {
    case "Literal":
    case "StringLiteral":
    case "TemplateLiteral":
      pushLiteral(ctx, node, kind);
      return;
    case "ArrayExpression":
      for (const el of getArray(node, "elements")) {
        if (el != null) {
          walkExpr(ctx, el, "array");
        }
      }
      return;
    case "ObjectExpression":
      for (const prop of getArray(node, "properties")) {
        if (!isRecord(prop)) {
          continue;
        }
        const propType = getString(prop, "type");
        if (propType === "Property" || propType === "ObjectProperty") {
          const key = getNode(prop, "key");
          const value = getNode(prop, "value");
          // Object keys are class names in clsx/cva object syntax: { "w-[40px]": cond }
          if (isRecord(key)) {
            const keyType = getString(key, "type");
            if (
              keyType === "Literal" ||
              keyType === "StringLiteral" ||
              keyType === "TemplateLiteral"
            ) {
              pushLiteral(ctx, key, "object-key");
            } else if (keyType === "Identifier" && prop.computed !== true) {
              // Bare identifier keys are not class strings.
            }
          }
          walkExpr(ctx, value, "object-value");
        } else if (propType === "SpreadElement") {
          walkExpr(ctx, getNode(prop, "argument"), kind);
        }
      }
      return;
    case "ConditionalExpression":
      walkExpr(ctx, getNode(node, "consequent"), "conditional");
      walkExpr(ctx, getNode(node, "alternate"), "conditional");
      return;
    case "LogicalExpression":
      walkExpr(ctx, getNode(node, "left"), kind);
      walkExpr(ctx, getNode(node, "right"), kind);
      return;
    case "BinaryExpression": {
      // String concatenation: "a" + "b"
      const op = getString(node, "operator");
      if (op === "+") {
        walkExpr(ctx, getNode(node, "left"), kind);
        walkExpr(ctx, getNode(node, "right"), kind);
      }
      return;
    }
    case "CallExpression": {
      const name = calleeName(getNode(node, "callee"));
      const nextKind =
        name && ctx.classFunctions.has(name)
          ? (name as ClassOccurrence["kind"])
          : kind;
      // cva base + variants object
      for (const arg of getArray(node, "arguments")) {
        walkExpr(ctx, arg, nextKind);
      }
      return;
    }
    case "TaggedTemplateExpression": {
      const tag = calleeName(getNode(node, "tag"));
      if (tag && ctx.taggedTemplates.has(tag)) {
        const quasi = getNode(node, "quasi");
        if (isRecord(quasi)) {
          pushTemplate(ctx, quasi, "tw");
        }
      }
      return;
    }
    case "JSXExpressionContainer":
      walkExpr(ctx, getNode(node, "expression"), kind);
      return;
    case "ParenthesizedExpression":
    case "TSAsExpression":
    case "TSSatisfiesExpression":
    case "TSNonNullExpression":
    case "ChainExpression":
      walkExpr(ctx, getNode(node, "expression"), kind);
      return;
    case "SequenceExpression":
      for (const expr of getArray(node, "expressions")) {
        walkExpr(ctx, expr, kind);
      }
      return;
    default:
      // Deep-walk unknown nodes for nested class helpers.
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) {
          for (const item of value) {
            if (isRecord(item) && typeof item.type === "string") {
              walkExpr(ctx, item, kind);
            }
          }
        } else if (isRecord(value) && typeof value.type === "string") {
          walkExpr(ctx, value, kind);
        }
      }
  }
}

function walkProgram(ctx: WalkerContext, node: unknown): void {
  if (!isRecord(node)) {
    return;
  }
  const type = getString(node, "type");

  if (type === "JSXAttribute") {
    const nameNode = getNode(node, "name");
    const attrName =
      isRecord(nameNode) && getString(nameNode, "type") === "JSXIdentifier"
        ? getString(nameNode, "name")
        : undefined;
    if (attrName === "className" || attrName === "class") {
      const value = getNode(node, "value");
      if (isRecord(value)) {
        const vType = getString(value, "type");
        if (vType === "Literal" || vType === "StringLiteral") {
          pushLiteral(ctx, value, attrName === "class" ? "class" : "className");
        } else if (vType === "JSXExpressionContainer") {
          walkExpr(
            ctx,
            getNode(value, "expression"),
            attrName === "class" ? "class" : "className",
          );
        }
      }
      return;
    }
  }

  if (type === "CallExpression") {
    const name = calleeName(getNode(node, "callee"));
    if (name && ctx.classFunctions.has(name)) {
      const kind = (["clsx", "cn", "cva", "twMerge", "classnames"].includes(name)
        ? name
        : "clsx") as ClassOccurrence["kind"];
      for (const arg of getArray(node, "arguments")) {
        walkExpr(ctx, arg, kind);
      }
      // Still walk nested for completeness but avoid double-counting via visited?
      // Arguments already walked; skip generic deep walk for this node.
      return;
    }
  }

  if (type === "TaggedTemplateExpression") {
    const tag = calleeName(getNode(node, "tag"));
    if (tag && ctx.taggedTemplates.has(tag)) {
      const quasi = getNode(node, "quasi");
      if (isRecord(quasi)) {
        pushTemplate(ctx, quasi, "tw");
      }
      return;
    }
  }

  // Generic walk
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isRecord(item) && typeof item.type === "string") {
          walkProgram(ctx, item);
        }
      }
    } else if (isRecord(value) && typeof value.type === "string") {
      walkProgram(ctx, value);
    }
  }
}

function languageFromPath(filePath: string | undefined): "tsx" | "ts" | "jsx" | "js" {
  const ext = extensionOf(filePath);
  switch (ext) {
    case ".ts":
    case ".mts":
    case ".cts":
      return "ts";
    case ".js":
    case ".mjs":
    case ".cjs":
      return "js";
    case ".jsx":
      return "jsx";
    default:
      return "tsx";
  }
}

/**
 * Extract class occurrences from JS/TS/JSX/TSX/MDX source using oxc AST.
 */
export function extractFromJavaScript(
  source: string,
  options: ExtractOptions = {},
): { occurrences: ClassOccurrence[]; errors: ExtractError[] } {
  const errors: ExtractError[] = [];
  const classFunctions = new Set([
    ...defaultClassFunctions(),
    ...(options.classFunctions ?? []),
  ]);
  const taggedTemplates = new Set([
    ...defaultTaggedTemplates(),
    ...(options.taggedTemplates ?? []),
  ]);

  const lang = languageFromPath(options.filePath);
  let program: unknown;
  try {
    const result = parseSync(options.filePath ?? "file.tsx", source, {
      sourceType: "module",
      lang,
      astType: "ts",
      showSemanticErrors: false,
    });
    if (result.errors?.length) {
      for (const err of result.errors) {
        errors.push({
          message: err.message,
          start: err.labels?.[0]?.start,
          end: err.labels?.[0]?.end,
        });
      }
    }
    program = result.program;
  } catch (error) {
    errors.push({
      message: error instanceof Error ? error.message : String(error),
    });
    return { occurrences: [], errors };
  }

  const ctx: WalkerContext = {
    source,
    occurrences: [],
    classFunctions,
    taggedTemplates,
    errors,
  };

  walkProgram(ctx, program);

  // Deduplicate exact same spans
  const seen = new Set<string>();
  const unique = ctx.occurrences.filter((o) => {
    const key = `${o.start}:${o.end}:${o.raw}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => a.start - b.start);
  return { occurrences: unique, errors };
}
