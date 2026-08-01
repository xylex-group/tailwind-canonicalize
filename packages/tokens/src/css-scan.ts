import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { colorsEqual, normalizeColor } from "./color-normalize.js";
import type { TokenAlias, ThemeToken, TokenSource } from "./types.js";

const CSS_EXTS = new Set([".css", ".scss", ".pcss"]);

/**
 * Scan project CSS for custom properties and build a token graph.
 */
export async function scanProjectTokens(
  cwd: string,
): Promise<{ tokens: ThemeToken[]; aliases: TokenAlias[]; files: string[] }> {
  const files = await collectCssFiles(cwd);
  const tokens = new Map<string, ThemeToken>();
  const aliases: TokenAlias[] = [];

  for (const file of files) {
    let css: string;
    try {
      css = await readFile(file, "utf8");
    } catch {
      continue;
    }
    parseCssVariables(css, file, tokens, aliases);
  }

  return { tokens: [...tokens.values()], aliases, files };
}

async function collectCssFiles(cwd: string): Promise<string[]> {
  const ignore = new Set([
    "node_modules",
    "dist",
    "build",
    ".git",
    "coverage",
    ".next",
    ".turbo",
  ]);
  const out: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (ignore.has(e.name)) {
        continue;
      }
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name.startsWith(".")) {
          continue;
        }
        await walk(full);
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (CSS_EXTS.has(ext)) {
          out.push(full);
        }
      }
    }
  }

  await walk(cwd);
  return out;
}

function parseCssVariables(
  css: string,
  file: string,
  tokens: Map<string, ThemeToken>,
  aliases: TokenAlias[],
): void {
  // Split into rule blocks roughly
  const blockRe = /([^{}@][^{]*)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null = blockRe.exec(css);
  while (m) {
    const selector = (m[1] ?? "").trim();
    const body = m[2] ?? "";
    const themeScope = scopeFromSelector(selector);
    const declRe = /--([a-zA-Z0-9-_]+)\s*:\s*([^;]+);/g;
    let d: RegExpExecArray | null = declRe.exec(body);
    while (d) {
      const name = `--${d[1]}`;
      const value = (d[2] ?? "").trim();
      const source: TokenSource = {
        kind: themeScope.kind,
        file,
        selector,
      };
      upsertToken(tokens, name, value, themeScope.theme, source);

      const aliasTarget = value.match(/^var\((--[a-zA-Z0-9-_]+)/);
      if (aliasTarget?.[1]) {
        aliases.push({
          from: name,
          to: aliasTarget[1],
          reason: "existing-alias",
        });
      }
      d = declRe.exec(body);
    }
    m = blockRe.exec(css);
  }

  // @theme blocks
  const themeRe = /@theme(?:\s+[^{]*)?\{([\s\S]*?)\}/g;
  let t: RegExpExecArray | null = themeRe.exec(css);
  while (t) {
    const body = t[1] ?? "";
    const declRe = /--([a-zA-Z0-9-_]+)\s*:\s*([^;]+);/g;
    let d: RegExpExecArray | null = declRe.exec(body);
    while (d) {
      const name = `--${d[1]}`;
      const value = (d[2] ?? "").trim();
      upsertToken(tokens, name, value, "default", {
        kind: "theme",
        file,
        selector: "@theme",
      });
      const aliasTarget = value.match(/^var\((--[a-zA-Z0-9-_]+)/);
      if (aliasTarget?.[1]) {
        aliases.push({
          from: name,
          to: aliasTarget[1],
          reason: "generated-tailwind-alias",
        });
      }
      d = declRe.exec(body);
    }
    t = themeRe.exec(css);
  }
}

function scopeFromSelector(selector: string): {
  kind: TokenSource["kind"];
  theme: string;
} {
  const s = selector.toLowerCase();
  if (s.includes(".dark") || s.includes("[data-theme=dark]") || s.includes("[data-mode=dark]")) {
    return { kind: "dark", theme: "dark" };
  }
  if (s.includes(":root") || s === "html" || s === "body") {
    return { kind: "root", theme: "light" };
  }
  if (s.includes("data-theme") || s.includes("data-mode")) {
    return { kind: "data-theme", theme: "custom" };
  }
  return { kind: "file", theme: "default" };
}

function upsertToken(
  tokens: Map<string, ThemeToken>,
  name: string,
  value: string,
  theme: string,
  source: TokenSource,
): void {
  let token = tokens.get(name);
  if (!token) {
    token = {
      name,
      namespace: namespaceOf(name),
      values: {},
      aliases: [],
      sources: [],
      generated: false,
    };
    tokens.set(name, token);
  }
  token.values[theme] = value;
  if (theme === "default" || theme === "light") {
    token.values.default = token.values.default ?? value;
    if (theme === "light") {
      token.values.light = value;
    }
  }
  token.sources.push(source);
}

function namespaceOf(name: string): ThemeToken["namespace"] {
  if (name.includes("color") || /--(bg|text|border|foreground|background|muted|primary|warning)/.test(name)) {
    return "color";
  }
  if (name.includes("spacing") || name.includes("space")) {
    return "spacing";
  }
  if (name.includes("radius")) {
    return "radius";
  }
  if (name.includes("shadow")) {
    return "shadow";
  }
  if (name.includes("font")) {
    return "font";
  }
  return "other";
}

/**
 * Detect alias cycles.
 */
export function findAliasCycles(aliases: TokenAlias[]): string[][] {
  const graph = new Map<string, string>();
  for (const a of aliases) {
    graph.set(a.from, a.to);
  }
  const cycles: string[][] = [];
  for (const start of graph.keys()) {
    const seen: string[] = [];
    let cur: string | undefined = start;
    const guard = new Set<string>();
    while (cur && !guard.has(cur)) {
      guard.add(cur);
      seen.push(cur);
      cur = graph.get(cur);
      if (cur === start) {
        cycles.push([...seen, start]);
        break;
      }
    }
  }
  // dedupe cycles
  const key = (c: string[]) => c.slice().sort().join(">");
  const uniq = new Map<string, string[]>();
  for (const c of cycles) {
    uniq.set(key(c), c);
  }
  return [...uniq.values()];
}

/**
 * Report tokens that share exact normalized colors (not auto-merged).
 */
export function findDuplicateValueTokens(tokens: ThemeToken[]): Array<{
  values: { light?: string; dark?: string };
  tokens: string[];
  note: string;
}> {
  const byLight = new Map<string, string[]>();
  for (const t of tokens) {
    if (t.namespace !== "color") {
      continue;
    }
    const light = t.values.light ?? t.values.default;
    if (!light || light.startsWith("var(")) {
      continue;
    }
    const n = normalizeColor(light);
    if (!n || n.startsWith("raw:")) {
      continue;
    }
    const list = byLight.get(n) ?? [];
    list.push(t.name);
    byLight.set(n, list);
  }

  const reports: Array<{
    values: { light?: string; dark?: string };
    tokens: string[];
    note: string;
  }> = [];

  for (const [light, names] of byLight) {
    if (names.length < 2) {
      continue;
    }
    reports.push({
      values: { light },
      tokens: names,
      note: "Exact light-mode value match. Do not auto-merge distinct semantic roles (e.g. background vs card).",
    });
  }

  void colorsEqual;
  return reports;
}

export async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}
