/**
 * Heuristic context signals for semantic color inference.
 * Inference is never certainty — only affects proposal confidence.
 */

const ROLE_PATTERNS: Array<{ role: string; re: RegExp }> = [
  { role: "warning", re: /warn|caution|amber|yellow/i },
  { role: "destructive", re: /error|danger|destructive|fail|critical/i },
  { role: "success", re: /success|valid|ok|complete|positive/i },
  { role: "info", re: /info|notice|hint|help/i },
  { role: "muted", re: /muted|subtle|secondary|caption|description/i },
  { role: "primary", re: /primary|brand|cta|action/i },
  { role: "selected", re: /select|active|current|chosen|highlight/i },
  { role: "decorative", re: /decor|ornament|accent|pattern/i },
  { role: "background", re: /page|layout|shell|canvas|surface|background/i },
  { role: "foreground", re: /body|copy|content|foreground|heading|title/i },
  { role: "border", re: /border|divider|separator|outline/i },
  { role: "alert", re: /\balert\b|role=["']alert["']/i },
];

export function inferContextSignals(input: {
  filePath: string;
  nearbySource: string;
  utility: string;
  componentName?: string;
  elementName?: string;
  ariaRole?: string;
  cvaVariant?: string;
}): string[] {
  const hay = [
    input.filePath,
    input.nearbySource,
    input.utility,
    input.componentName ?? "",
    input.elementName ?? "",
    input.ariaRole ?? "",
    input.cvaVariant ?? "",
  ].join(" ");

  const signals: string[] = [];
  for (const { role, re } of ROLE_PATTERNS) {
    if (re.test(hay)) {
      signals.push(role === "alert" ? "destructive" : role);
    }
  }

  if (input.ariaRole === "alert" || input.ariaRole === "alertdialog") {
    signals.push("destructive", "warning");
  }
  if (input.cvaVariant) {
    const v = input.cvaVariant.toLowerCase();
    for (const role of [
      "warning",
      "destructive",
      "success",
      "info",
      "primary",
      "secondary",
      "muted",
    ]) {
      if (v.includes(role)) {
        signals.push(role);
      }
    }
  }

  if (/amber|yellow/.test(input.utility)) {
    signals.push("warning");
  }
  if (/red|rose/.test(input.utility)) {
    signals.push("destructive");
  }
  if (/green|emerald/.test(input.utility)) {
    signals.push("success");
  }
  if (/blue|sky|cyan/.test(input.utility)) {
    signals.push("info");
  }
  if (/slate|gray|zinc|neutral|stone/.test(input.utility)) {
    signals.push("muted");
    signals.push("foreground");
  }
  if (/bg-white|bg-black/.test(input.utility)) {
    signals.push("background");
  }

  return [...new Set(signals)];
}

/**
 * Extract nearby JSX element name, aria role, and cva variant hints from source slice.
 */
export function extractStructuralHints(nearby: string): {
  elementName?: string;
  ariaRole?: string;
  cvaVariant?: string;
} {
  const element =
    nearby.match(/<([A-Z][A-Za-z0-9.]*)\b/)?.[1] ??
    nearby.match(/<([a-z][a-z0-9-]*)\b/)?.[1];
  const ariaRole =
    nearby.match(/\brole\s*=\s*["']([^"']+)["']/)?.[1] ??
    nearby.match(/\baria-role\s*=\s*["']([^"']+)["']/)?.[1];

  // cva({ variants: { intent: { warning: "..." }}}) or variant: "warning"
  const cvaVariant =
    nearby.match(/\b(?:variant|intent|tone|status)\s*:\s*["']([a-zA-Z-]+)["']/)?.[1] ??
    nearby.match(/\b(?:variant|intent|tone|status)\s*:\s*\{\s*([a-zA-Z-]+)\s*:/)?.[1];

  return {
    elementName: element,
    ariaRole: ariaRole,
    cvaVariant: cvaVariant,
  };
}

export function proposeSemanticToken(
  property: string,
  palette: string,
  shade: string | null,
  dominantRole: string | null,
): { token: string; cssVariable: string } | null {
  const role = dominantRole;
  if (!role) {
    if (palette === "white" && property === "bg") {
      return { token: "background", cssVariable: "--color-background" };
    }
    if (palette === "black" && property === "text") {
      return { token: "foreground", cssVariable: "--color-foreground" };
    }
    if (palette === "black" && property === "bg") {
      return { token: "foreground", cssVariable: "--color-foreground" };
    }
    if (
      (palette === "slate" || palette === "gray" || palette === "zinc") &&
      property === "text"
    ) {
      const n = shade ? Number(shade) : 500;
      if (n >= 700) {
        return { token: "foreground", cssVariable: "--color-foreground" };
      }
      return { token: "muted-foreground", cssVariable: "--color-muted-foreground" };
    }
    if (
      (palette === "slate" || palette === "gray") &&
      property.startsWith("border")
    ) {
      return { token: "border", cssVariable: "--color-border" };
    }
    if (palette === "red" && property === "ring") {
      return { token: "destructive", cssVariable: "--color-destructive" };
    }
    if (palette === "blue" && property === "fill") {
      return { token: "primary", cssVariable: "--color-primary" };
    }
    return null;
  }

  if (role === "warning") {
    if (property === "bg" || property.startsWith("border")) {
      return { token: "warning-subtle", cssVariable: "--color-warning-subtle" };
    }
    if (property === "text") {
      return { token: "warning-foreground", cssVariable: "--color-warning-foreground" };
    }
    if (property === "ring") {
      return { token: "warning", cssVariable: "--color-warning" };
    }
  }
  if (role === "destructive") {
    if (property === "bg") {
      return { token: "destructive", cssVariable: "--color-destructive" };
    }
    if (property === "text") {
      return {
        token: "destructive-foreground",
        cssVariable: "--color-destructive-foreground",
      };
    }
    if (property === "ring" || property.startsWith("border")) {
      return { token: "destructive", cssVariable: "--color-destructive" };
    }
  }
  if (role === "success") {
    if (property === "bg") {
      return { token: "success-subtle", cssVariable: "--color-success-subtle" };
    }
    if (property === "text") {
      return { token: "success-foreground", cssVariable: "--color-success-foreground" };
    }
  }
  if (role === "background" && property === "bg") {
    return { token: "background", cssVariable: "--color-background" };
  }
  if (role === "foreground" && property === "text") {
    return { token: "foreground", cssVariable: "--color-foreground" };
  }
  if (role === "muted" && property === "text") {
    return { token: "muted-foreground", cssVariable: "--color-muted-foreground" };
  }
  if (role === "border" && property.startsWith("border")) {
    return { token: "border", cssVariable: "--color-border" };
  }
  if (role === "primary") {
    if (property === "bg" || property === "text" || property === "fill") {
      return { token: "primary", cssVariable: "--color-primary" };
    }
  }
  if (role === "selected") {
    return null; // conflict-prone; never auto-propose selected → warning
  }

  return null;
}

export function buildTargetUtility(property: string, tokenName: string): string {
  return `${property}-${tokenName}`;
}

/** Default light palette approximations for dual-theme pair proposals (documentation only). */
export const DEFAULT_PALETTE_HEX: Record<string, string> = {
  "bg-white": "#ffffff",
  "bg-black": "#000000",
  "bg-slate-950": "#020617",
  "bg-slate-900": "#0f172a",
  "text-slate-800": "#1e293b",
  "text-slate-100": "#f1f5f9",
  "text-slate-600": "#475569",
  "border-slate-200": "#e2e8f0",
  "border-slate-800": "#1e293b",
  "bg-amber-200": "#fde68a",
  "border-amber-200": "#fde68a",
};
