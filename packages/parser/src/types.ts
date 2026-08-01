/**
 * A contiguous class-token region extracted from source.
 * Offsets are UTF-16 code unit indices into the original source string.
 */
export interface ClassOccurrence {
  /** Raw class text as written in source (may include whitespace/newlines). */
  raw: string;
  /** Byte/char start offset of the class value content (inside quotes). */
  start: number;
  /** Byte/char end offset of the class value content (exclusive). */
  end: number;
  /** Extraction origin for diagnostics. */
  kind:
    | "class"
    | "className"
    | "clsx"
    | "cn"
    | "cva"
    | "twMerge"
    | "classnames"
    | "tw"
    | "template"
    | "array"
    | "object-key"
    | "object-value"
    | "conditional"
    | "html-class"
    | "unknown";
  /** Whether the string was a template literal (may contain expressions). */
  isTemplate?: boolean;
  /** True when the region contains `${...}` interpolations that must be preserved. */
  hasInterpolation?: boolean;
}

export type SupportedExtension =
  | ".ts"
  | ".tsx"
  | ".js"
  | ".jsx"
  | ".mjs"
  | ".cjs"
  | ".mts"
  | ".cts"
  | ".html"
  | ".vue"
  | ".astro"
  | ".mdx"
  | ".svelte";

export interface ExtractOptions {
  filePath?: string;
  /**
   * Extra function identifiers treated like `clsx` / `cn`.
   * Default: clsx, cn, classnames, twMerge, cva, cx, tv
   */
  classFunctions?: string[];
  /**
   * Tagged template tags treated as class containers (e.g. `tw`).
   * Default: tw
   */
  taggedTemplates?: string[];
}

export interface ExtractResult {
  occurrences: ClassOccurrence[];
  language: "javascript" | "html" | "vue" | "astro" | "svelte" | "mdx" | "unknown";
  errors: ExtractError[];
}

export interface ExtractError {
  message: string;
  start?: number;
  end?: number;
}
