import type { Theme } from "./types.js";

export type CompileEqualFn = (a: string, b: string) => boolean | Promise<boolean>;

/**
 * Normalize compiled CSS utility declarations for exact comparison.
 * Strips @layer wrappers and selectors so we compare property:value sets.
 */
export function normalizeCompiledCss(css: string): string {
  const decls: string[] = [];
  const re = /\{([^{}]+)\}/g;
  let m: RegExpExecArray | null = re.exec(css);
  while (m) {
    const body = (m[1] ?? "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/\s*:\s*/g, ":").toLowerCase())
      .sort();
    if (body.length > 0) {
      decls.push(body.join(";"));
    }
    m = re.exec(css);
  }
  return decls.sort().join("||");
}

type TailwindCompile = (input: string) => Promise<{
  build: (candidates: string[]) => string;
}>;

/**
 * Create a compile-equal comparator using Tailwind v4's programmatic API when
 * the optional `tailwindcss` package is installed. Returns null if unavailable.
 *
 * After `await createTailwindCompileEqual(...)`, the returned function is **sync**
 * (compile() is async once; build() is sync).
 */
export async function createTailwindCompileEqual(options: {
  css?: string;
  theme?: Theme;
  cache?: Map<string, string>;
}): Promise<CompileEqualFn | null> {
  let compile: TailwindCompile | null = null;

  try {
    // Optional peer — may not be installed in consumers
    const modName = "tailwindcss";
    const mod = (await import(modName)) as {
      compile?: TailwindCompile;
      default?: { compile?: TailwindCompile };
    };
    compile = mod.compile ?? mod.default?.compile ?? null;
  } catch {
    return null;
  }

  if (!compile) {
    return null;
  }

  let cssInput = options.css ?? '@import "tailwindcss";\n';
  if (options.theme?.cssVariables.size) {
    const lines = [...options.theme.cssVariables.entries()]
      .map(([k, v]) => `  ${k}: ${v};`)
      .join("\n");
    cssInput += `\n@theme {\n${lines}\n}\n`;
  }

  let builder: { build: (candidates: string[]) => string };
  try {
    builder = await compile(cssInput);
  } catch {
    return null;
  }

  const cache = options.cache ?? new Map<string, string>();

  const compileOne = (className: string): string => {
    const hit = cache.get(className);
    if (hit !== undefined) {
      return hit;
    }
    try {
      const raw = builder.build([className]);
      const norm = normalizeCompiledCss(raw);
      cache.set(className, norm);
      return norm;
    } catch {
      cache.set(className, "");
      return "";
    }
  };

  return (a: string, b: string) => {
    const ca = compileOne(a);
    const cb = compileOne(b);
    if (!ca || !cb) {
      return false;
    }
    return ca === cb;
  };
}

/**
 * Sync fallback: never claims equality (strict compile unavailable).
 */
export function unavailableCompileEqual(): CompileEqualFn {
  return () => false;
}
