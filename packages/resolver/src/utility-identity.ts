import { parseUtility } from "./parse-utility.js";
import type { UtilityIdentity } from "./categories.js";

/**
 * Map utility namespaces to a conflict/dedupe property group.
 * Utilities in the same group with the same variants compete.
 */
const PROPERTY_GROUPS: Record<string, string> = {
  w: "width",
  "min-w": "min-width",
  "max-w": "max-width",
  h: "height",
  "min-h": "min-height",
  "max-h": "max-height",
  size: "size",
  p: "padding",
  px: "padding-x",
  py: "padding-y",
  pt: "padding-top",
  pr: "padding-right",
  pb: "padding-bottom",
  pl: "padding-left",
  ps: "padding-inline-start",
  pe: "padding-inline-end",
  m: "margin",
  mx: "margin-x",
  my: "margin-y",
  mt: "margin-top",
  mr: "margin-right",
  mb: "margin-bottom",
  ml: "margin-left",
  ms: "margin-inline-start",
  me: "margin-inline-end",
  gap: "gap",
  "gap-x": "gap-x",
  "gap-y": "gap-y",
  "space-x": "space-x",
  "space-y": "space-y",
  inset: "inset",
  "inset-x": "inset-x",
  "inset-y": "inset-y",
  top: "top",
  right: "right",
  bottom: "bottom",
  left: "left",
  start: "inset-inline-start",
  end: "inset-inline-end",
  "translate-x": "translate-x",
  "translate-y": "translate-y",
  basis: "flex-basis",
  indent: "text-indent",
  leading: "line-height",
  tracking: "letter-spacing",
  rounded: "border-radius",
  blur: "blur",
  "backdrop-blur": "backdrop-blur",
  bg: "background-color",
  text: "color-or-font-size",
  border: "border-color-or-width",
  "border-t": "border-top",
  "border-r": "border-right",
  "border-b": "border-bottom",
  "border-l": "border-left",
  "border-x": "border-x",
  "border-y": "border-y",
  ring: "ring-color",
  fill: "fill",
  stroke: "stroke",
  outline: "outline-color",
  from: "gradient-from",
  via: "gradient-via",
  to: "gradient-to",
  shadow: "box-shadow",
  opacity: "opacity",
  "border-spacing": "border-spacing",
  "border-spacing-x": "border-spacing-x",
  "border-spacing-y": "border-spacing-y",
  "scroll-m": "scroll-margin",
  "scroll-p": "scroll-padding",
};

export function propertyGroupForNamespace(namespace: string): string {
  if (PROPERTY_GROUPS[namespace]) {
    return PROPERTY_GROUPS[namespace]!;
  }
  if (namespace.startsWith("rounded-")) {
    return `border-radius-${namespace.slice("rounded-".length)}`;
  }
  if (namespace.startsWith("scroll-m")) {
    return namespace;
  }
  if (namespace.startsWith("scroll-p")) {
    return namespace;
  }
  // Gradients / multi-segment bases
  if (namespace.startsWith("bg-gradient") || namespace.startsWith("bg-linear")) {
    return "background-image-gradient";
  }
  // Multi-segment color utilities parse as e.g. namespace `text-muted` + value
  // `foreground` or `text-red` + `500`. Collapse to the same cascade slot as
  // bare `text-*` / `bg-*` so cssConflict matches IntelliSense.
  if (namespace === "text" || namespace.startsWith("text-")) {
    return "color-or-font-size";
  }
  if (namespace === "bg" || namespace.startsWith("bg-")) {
    return "background-color";
  }
  if (namespace === "from" || namespace.startsWith("from-")) {
    return "gradient-from";
  }
  if (namespace === "via" || namespace.startsWith("via-")) {
    return "gradient-via";
  }
  if (namespace === "to" || namespace.startsWith("to-")) {
    return "gradient-to";
  }
  if (namespace === "fill" || namespace.startsWith("fill-")) {
    return "fill";
  }
  if (namespace === "stroke" || namespace.startsWith("stroke-")) {
    return "stroke";
  }
  if (namespace === "ring" || namespace.startsWith("ring-")) {
    // ring-2 is width; ring-red-500 is color — keep coarse group for conflicts
    return namespace.startsWith("ring-offset") ? namespace : "ring-color";
  }
  return namespace || "unknown";
}

/**
 * Build a normalized utility identity for dedupe/conflict analysis.
 */
export function utilityIdentity(token: string): UtilityIdentity {
  const parts = parseUtility(token);
  const variantStr = parts.variants.endsWith(":")
    ? parts.variants.slice(0, -1)
    : parts.variants;
  const variants = variantStr ? variantStr.split(":").filter(Boolean) : [];
  const propertyGroup = propertyGroupForNamespace(parts.namespace || parts.base);
  const value = parts.isArbitrary
    ? parts.value
    : parts.value
      ? parts.value
      : parts.base;

  const normalized = [
    variants.join(":"),
    parts.important ? "!" : "",
    propertyGroup,
    parts.negative ? "-" : "",
    parts.namespace || parts.base,
    value,
  ].join("|");

  return {
    variants,
    important: parts.important,
    propertyGroup,
    value: `${parts.negative ? "-" : ""}${value}`,
    normalized,
  };
}

/**
 * True when two tokens compete for the same cascade slot
 * (same variants + important + property group).
 */
export function utilitiesConflict(a: string, b: string): boolean {
  const ia = utilityIdentity(a);
  const ib = utilityIdentity(b);
  if (ia.variants.join(":") !== ib.variants.join(":")) {
    return false;
  }
  if (ia.important !== ib.important) {
    return false;
  }
  return ia.propertyGroup === ib.propertyGroup && ia.propertyGroup !== "unknown";
}
