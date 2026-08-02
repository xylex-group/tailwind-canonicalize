import type { Theme, ThemeScale } from "./types.js";

/**
 * Map a utility namespace to the theme scale that resolves its values.
 */
export function scaleForNamespace(namespace: string, theme: Theme): ThemeScale | null {
  // Spacing-like
  const spacingNamespaces = new Set([
    "p",
    "px",
    "py",
    "pt",
    "pr",
    "pb",
    "pl",
    "ps",
    "pe",
    "m",
    "mx",
    "my",
    "mt",
    "mr",
    "mb",
    "ml",
    "ms",
    "me",
    "gap",
    "gap-x",
    "gap-y",
    "space-x",
    "space-y",
    "w",
    "h",
    "size",
    "min-w",
    "min-h",
    "max-w",
    "max-h",
    "inset",
    "inset-x",
    "inset-y",
    "top",
    "right",
    "bottom",
    "left",
    "start",
    "end",
    "scroll-m",
    "scroll-mx",
    "scroll-my",
    "scroll-mt",
    "scroll-mr",
    "scroll-mb",
    "scroll-ml",
    "scroll-p",
    "scroll-px",
    "scroll-py",
    "scroll-pt",
    "scroll-pr",
    "scroll-pb",
    "scroll-pl",
    "translate-x",
    "translate-y",
    "indent",
    "basis",
    "border-spacing",
    "border-spacing-x",
    "border-spacing-y",
    "scroll-ms",
    "scroll-me",
    "scroll-ps",
    "scroll-pe",
  ]);

  if (spacingNamespaces.has(namespace)) {
    return theme.spacing;
  }

  // Border width utilities (border-2, border-b-8) — px scale, not spacing.
  if (isBorderWidthNamespace(namespace)) {
    return theme.borderWidth;
  }

  if (
    namespace === "rounded" ||
    namespace.startsWith("rounded-")
  ) {
    return theme.borderRadius;
  }

  if (namespace === "text") {
    // text-* may be font-size OR color — resolver tries both
    return theme.fontSize;
  }

  if (namespace === "leading") {
    return theme.lineHeight;
  }

  if (namespace === "tracking") {
    return theme.letterSpacing;
  }

  if (namespace === "blur" || namespace === "backdrop-blur") {
    return theme.blur;
  }

  if (namespace === "shadow" || namespace === "drop-shadow") {
    return theme.boxShadow;
  }

  if (namespace === "opacity") {
    return theme.opacity;
  }

  if (
    namespace === "bg" ||
    namespace === "from" ||
    namespace === "via" ||
    namespace === "to" ||
    namespace === "fill" ||
    namespace === "stroke" ||
    namespace === "accent" ||
    namespace === "caret" ||
    namespace === "decoration" ||
    namespace === "outline" ||
    namespace === "ring" ||
    namespace === "divide" ||
    namespace === "border-color"
  ) {
    return theme.colors;
  }

  // Multi-segment color namespaces: border-red, border-muted, …
  // (width namespaces already returned above)
  if (
    namespace.startsWith("border-") &&
    !namespace.startsWith("border-spacing") &&
    !isBorderWidthNamespace(namespace)
  ) {
    return theme.colors;
  }

  return null;
}

/** `border`, `border-t`, … — width utilities use the borderWidth px scale. */
export function isBorderWidthNamespace(namespace: string): boolean {
  return (
    namespace === "border" ||
    namespace === "border-t" ||
    namespace === "border-r" ||
    namespace === "border-b" ||
    namespace === "border-l" ||
    namespace === "border-x" ||
    namespace === "border-y" ||
    namespace === "border-s" ||
    namespace === "border-e"
  );
}

/**
 * Namespaces where `text-[16px]` means font-size and `text-[#ff0000]` means color.
 */
export function alternateScales(namespace: string, theme: Theme): ThemeScale[] {
  if (namespace === "text") {
    return [theme.fontSize, theme.colors];
  }
  // Width primary + color alternate so border-[#fff] can still match colors
  // and border-[8px] matches borderWidth (never spacing).
  if (isBorderWidthNamespace(namespace)) {
    return [theme.colors];
  }
  return [];
}

/** Keyword rewrites that do not need theme lookup (exact CSS keyword match). */
export const KEYWORD_MAP: Record<string, Record<string, string>> = {
  w: {
    auto: "auto",
    "100%": "full",
    "100vw": "screen",
    "min-content": "min",
    "max-content": "max",
    "fit-content": "fit",
  },
  h: {
    auto: "auto",
    "100%": "full",
    "100vh": "screen",
    "100svh": "svh",
    "100dvh": "dvh",
    "100lvh": "lvh",
    "min-content": "min",
    "max-content": "max",
    "fit-content": "fit",
  },
  size: {
    auto: "auto",
    "100%": "full",
    "min-content": "min",
    "max-content": "max",
    "fit-content": "fit",
  },
  "min-w": {
    "100%": "full",
    "min-content": "min",
    "max-content": "max",
    "fit-content": "fit",
  },
  "min-h": {
    "100%": "full",
    "100vh": "screen",
    "min-content": "min",
    "max-content": "max",
    "fit-content": "fit",
  },
  "max-w": {
    "100%": "full",
    "min-content": "min",
    "max-content": "max",
    "fit-content": "fit",
  },
  "max-h": {
    "100%": "full",
    "100vh": "screen",
    "min-content": "min",
    "max-content": "max",
    "fit-content": "fit",
  },
  inset: {
    auto: "auto",
    "100%": "full",
  },
  top: { auto: "auto", "100%": "full" },
  right: { auto: "auto", "100%": "full" },
  bottom: { auto: "auto", "100%": "full" },
  left: { auto: "auto", "100%": "full" },
  basis: {
    auto: "auto",
    "100%": "full",
  },
  // Transition timing — match after normalizeEaseValue (no spaces)
  ease: {
    linear: "linear",
    "cubic-bezier(0.4,0,0.2,1)": "in-out",
    "cubic-bezier(0.4,0,1,1)": "in",
    "cubic-bezier(0,0,0.2,1)": "out",
  },
  z: {
    auto: "auto",
  },
};

/**
 * Normalize timing-function strings for keyword lookup
 * (lowercase, strip whitespace inside cubic-bezier).
 */
export function normalizeEaseValue(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "");
}
