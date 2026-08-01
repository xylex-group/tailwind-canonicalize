export type TokenNamespace =
  | "color"
  | "spacing"
  | "radius"
  | "shadow"
  | "font"
  | "breakpoint"
  | "other";

export interface TokenSource {
  kind: "theme" | "root" | "dark" | "data-theme" | "file" | "generated";
  file?: string;
  selector?: string;
}

export interface ThemeToken {
  name: string;
  namespace: TokenNamespace;
  semanticRole?: string;
  values: {
    default?: string;
    light?: string;
    dark?: string;
    [theme: string]: string | undefined;
  };
  aliases: string[];
  sources: TokenSource[];
  generated: boolean;
}

export interface TokenAlias {
  from: string;
  to: string;
  reason:
    | "existing-alias"
    | "exact-value-match"
    | "approved-semantic-alias"
    | "generated-tailwind-alias";
}

export interface SemanticColorRecipe {
  name: string;
  utilities: {
    background?: string;
    foreground?: string;
    border?: string;
    ring?: string;
    icon?: string;
  };
  sources?: {
    background?: string;
    foreground?: string;
    border?: string;
    ring?: string;
    icon?: string;
  };
}

export interface ThemePairMapping {
  light: string;
  dark: string;
  target: string;
  token?: string;
  proven?: boolean;
}

export interface ColorOccurrence {
  file: string;
  line: number;
  column: number;
  utility: string;
  base: string;
  property: string;
  palette: string;
  shade: string | null;
  componentHint?: string;
  elementHint?: string;
  ariaRole?: string;
  cvaVariant?: string;
  siblingBases?: string[];
  contextSignals: string[];
}

export interface ColorAnalysisEntry {
  sourceUtility: string;
  occurrences: number;
  contexts: Record<string, number>;
  proposal: {
    token: string;
    cssVariable: string;
  } | null;
  confidence: number;
  conflicts: Array<{ file: string; reason: string }>;
  samples: ColorOccurrence[];
}

export interface CombinationAnalysis {
  bases: string[];
  count: number;
  proposedRecipe: string | null;
  confidence: number;
}

export interface TokenManifest {
  $schema?: string;
  version: 1;
  mappings: Array<{
    source: string;
    target: string;
    token?: string;
    category?: "semantic-color-token" | "semantic-spacing-token";
    confidence?: number;
  }>;
  pairs?: ThemePairMapping[];
  recipes?: SemanticColorRecipe[];
  generateTheme?: {
    path?: string;
    preferAppAliases?: boolean;
    /** Emit :root / .dark app vars + @theme inline */
    dualTheme?: boolean;
    values?: Record<
      string,
      { light?: string; dark?: string; default?: string }
    >;
  };
}

export interface DuplicateTokenReport {
  values: { light?: string; dark?: string };
  tokens: string[];
  note: string;
}

export interface TokenAnalyzeResult {
  colors: ColorAnalysisEntry[];
  combinations: CombinationAnalysis[];
  existingTokens: ThemeToken[];
  aliases: TokenAlias[];
  duplicates: DuplicateTokenReport[];
  cycles: string[][];
  proposedManifest: TokenManifest;
  proposedPairs: ThemePairMapping[];
  proposedRecipes: SemanticColorRecipe[];
}

export const DEFAULT_SEMANTIC_FAMILIES = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "border",
  "input",
  "ring",
  "success",
  "success-foreground",
  "success-subtle",
  "warning",
  "warning-foreground",
  "warning-subtle",
  "destructive",
  "destructive-foreground",
  "destructive-subtle",
  "info",
  "info-foreground",
  "info-subtle",
] as const;

export const DEFAULT_RECIPES: SemanticColorRecipe[] = [
  {
    name: "warning-surface",
    sources: {
      background: "bg-amber-200",
      border: "border-amber-200",
      foreground: "text-slate-800",
    },
    utilities: {
      background: "bg-warning-subtle",
      border: "border-warning-subtle",
      foreground: "text-warning-foreground",
    },
  },
  {
    name: "destructive-surface",
    utilities: {
      background: "bg-destructive",
      foreground: "text-destructive-foreground",
      border: "border-destructive",
    },
  },
  {
    name: "surface",
    sources: {
      background: "bg-white",
      foreground: "text-slate-800",
      border: "border-slate-200",
    },
    utilities: {
      background: "bg-background",
      foreground: "text-foreground",
      border: "border-border",
    },
  },
];
