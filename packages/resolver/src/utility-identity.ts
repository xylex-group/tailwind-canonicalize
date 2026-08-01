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
  // text / border / flex / ring handled in propertyGroupForNamespace
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

const TEXT_ALIGN = new Set(["left", "center", "right", "justify", "start", "end"]);
const TEXT_WRAP = new Set(["wrap", "nowrap", "balance", "pretty"]);
const TEXT_OVERFLOW = new Set(["ellipsis", "clip"]);
const FONT_SIZE_KEYS = new Set([
  "xs",
  "sm",
  "base",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "6xl",
  "7xl",
  "8xl",
  "9xl",
]);
/** Common design-system type scale names (font-size, not color). */
const TEXT_TYPOGRAPHY = new Set([
  "caption",
  "tiny",
  "body",
  "body-sm",
  "body-lg",
  "display",
  "heading",
  "title",
  "subtitle",
  "label",
  "overline",
  "prose",
  "code",
  "quote",
  "lead",
  "footnote",
]);

/**
 * Split text-* utilities into independent cascade slots.
 * Alignment, wrap, overflow, font-size, and color never share a group.
 */
function textPropertyGroup(namespace: string, value: string): string {
  // Multi-segment: text-muted-foreground → ns text-muted + value foreground
  //                text-body-sm → ns text-body + value sm (typography scale)
  if (namespace.startsWith("text-") && namespace !== "text") {
    const rest = namespace.slice("text-".length);
    const full = value ? `${rest}-${value}` : rest;
    if (
      TEXT_TYPOGRAPHY.has(rest) ||
      TEXT_TYPOGRAPHY.has(full) ||
      FONT_SIZE_KEYS.has(value)
    ) {
      return "font-size";
    }
    return "text-color";
  }
  // bare text-* (namespace === "text")
  if (TEXT_ALIGN.has(value)) {
    return "text-align";
  }
  if (TEXT_WRAP.has(value)) {
    return "text-wrap";
  }
  if (TEXT_OVERFLOW.has(value)) {
    return "text-overflow";
  }
  if (FONT_SIZE_KEYS.has(value) || TEXT_TYPOGRAPHY.has(value)) {
    return "font-size";
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim().toLowerCase();
    if (
      inner.startsWith("#") ||
      inner.startsWith("rgb") ||
      inner.startsWith("hsl") ||
      inner.startsWith("oklch") ||
      inner.startsWith("oklab") ||
      inner.startsWith("color(") ||
      (inner.startsWith("var(") && inner.includes("color"))
    ) {
      return "text-color";
    }
    // lengths → font-size
    if (
      /^[-+]?\d/.test(inner) ||
      inner.endsWith("px") ||
      inner.endsWith("rem") ||
      inner.endsWith("em")
    ) {
      return "font-size";
    }
  }
  // text-black, text-foreground, text-transparent, etc.
  return "text-color";
}

const FLEX_DIRECTION = new Set(["row", "row-reverse", "col", "col-reverse"]);
const FLEX_WRAP = new Set(["wrap", "wrap-reverse", "nowrap"]);
const FLEX_SHORTHAND = new Set(["1", "auto", "initial", "none"]);

/**
 * display:flex vs flex-direction vs flex-wrap vs flex shorthand are independent.
 */
function flexPropertyGroup(namespace: string, value: string): string {
  if (namespace === "grow" || namespace === "flex-grow") {
    return "flex-grow";
  }
  if (namespace === "shrink" || namespace === "flex-shrink") {
    return "flex-shrink";
  }
  if (namespace === "basis" || namespace === "flex-basis") {
    return "flex-basis";
  }
  if (namespace !== "flex") {
    return namespace;
  }
  if (value === "" || value === "inline") {
    return "display";
  }
  if (FLEX_DIRECTION.has(value)) {
    return "flex-direction";
  }
  if (FLEX_WRAP.has(value)) {
    return "flex-wrap";
  }
  if (FLEX_SHORTHAND.has(value) || /^\d+(\.\d+)?$/.test(value)) {
    return "flex";
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    return "flex";
  }
  return "flex";
}

const BORDER_STYLE = new Set([
  "solid",
  "dashed",
  "dotted",
  "double",
  "hidden",
  "none",
]);
const BORDER_SIDE = new Set(["t", "r", "b", "l", "x", "y", "s", "e"]);
const BORDER_WIDTH_KEYS = new Set(["0", "2", "4", "8"]);

function isBorderWidthValue(value: string): boolean {
  if (value === "" || BORDER_WIDTH_KEYS.has(value) || /^\d+(\.\d+)?$/.test(value)) {
    return true;
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim().toLowerCase();
    if (
      /^[-+]?\d/.test(inner) ||
      inner.endsWith("px") ||
      inner.endsWith("rem") ||
      inner.endsWith("em")
    ) {
      return true;
    }
  }
  return false;
}

function isBorderColorValue(value: string): boolean {
  if (!value || BORDER_STYLE.has(value) || isBorderWidthValue(value)) {
    return false;
  }
  if (BORDER_SIDE.has(value)) {
    return false;
  }
  return true;
}

/**
 * Split border width / style / color / sides into independent cascade slots.
 * `border` + `border-border` must not conflict (width vs color).
 */
function borderPropertyGroup(namespace: string, value: string): string {
  // border-spacing handled elsewhere
  if (namespace.startsWith("border-spacing")) {
    return namespace;
  }

  // Directional: border-t, border-b-2, border-t-red-500
  const sideMatch = namespace.match(
    /^border-(t|r|b|l|x|y|s|e)$/,
  );
  if (sideMatch) {
    const side = sideMatch[1]!;
    if (BORDER_STYLE.has(value)) {
      return `border-${side}-style`;
    }
    if (isBorderWidthValue(value) || value === "") {
      return `border-${side}-width`;
    }
    return `border-${side}-color`;
  }

  // namespace border + value is a bare side letter (border-b, border-r)
  if (namespace === "border" && BORDER_SIDE.has(value)) {
    return `border-${value}-width`;
  }

  if (namespace === "border") {
    if (BORDER_STYLE.has(value)) {
      return "border-style";
    }
    if (isBorderWidthValue(value)) {
      return "border-width";
    }
    if (isBorderColorValue(value)) {
      return "border-color";
    }
    return "border-width";
  }

  // Multi-segment color: border-red + 500, border-muted + foreground
  if (namespace.startsWith("border-")) {
    const rest = namespace.slice("border-".length);
    if (BORDER_SIDE.has(rest.split("-")[0] ?? "")) {
      // border-t-red / border-t-2 already handled via sideMatch when ns is border-t
      return `border-${rest}-color`;
    }
    return "border-color";
  }

  return "border-color";
}


const RING_WIDTH_KEYS = new Set(["0", "1", "2", "4", "8"]);

function ringPropertyGroup(namespace: string, value: string): string {
  if (namespace.startsWith("ring-offset")) {
    if (namespace === "ring-offset") {
      if (
        value === "" ||
        RING_WIDTH_KEYS.has(value) ||
        /^\d+(\.\d+)?$/.test(value)
      ) {
        return "ring-offset-width";
      }
      if (value.startsWith("[") && value.endsWith("]")) {
        const inner = value.slice(1, -1).trim().toLowerCase();
        if (
          /^[-+]?\d/.test(inner) ||
          inner.endsWith("px") ||
          inner.endsWith("rem") ||
          inner.endsWith("em")
        ) {
          return "ring-offset-width";
        }
      }
      return "ring-offset-color";
    }
    return "ring-offset-color";
  }
  if (namespace === "ring") {
    if (value === "inset") {
      return "ring-inset";
    }
    if (
      value === "" ||
      RING_WIDTH_KEYS.has(value) ||
      /^\d+(\.\d+)?$/.test(value)
    ) {
      return "ring-width";
    }
    if (value.startsWith("[") && value.endsWith("]")) {
      const inner = value.slice(1, -1).trim().toLowerCase();
      if (
        inner.startsWith("#") ||
        inner.startsWith("rgb") ||
        inner.startsWith("hsl") ||
        inner.startsWith("oklch") ||
        inner.startsWith("oklab") ||
        inner.startsWith("color(")
      ) {
        return "ring-color";
      }
      if (
        /^[-+]?\d/.test(inner) ||
        inner.endsWith("px") ||
        inner.endsWith("rem") ||
        inner.endsWith("em")
      ) {
        return "ring-width";
      }
    }
    return "ring-color";
  }
  // Multi-segment: ring-blue + 500, ring-red, etc.
  return "ring-color";
}
export function propertyGroupForNamespace(namespace: string, value = ""): string {
  // text / flex / border / ring need value-aware classification
  if (namespace === "text" || namespace.startsWith("text-")) {
    return textPropertyGroup(namespace, value);
  }
  if (
    namespace === "flex" ||
    namespace === "grow" ||
    namespace === "shrink" ||
    namespace === "basis" ||
    namespace.startsWith("flex-")
  ) {
    return flexPropertyGroup(namespace, value);
  }
  if (namespace === "border" || namespace.startsWith("border-")) {
    return borderPropertyGroup(namespace, value);
  }
  if (namespace === "ring" || namespace.startsWith("ring-")) {
    return ringPropertyGroup(namespace, value);
  }
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
  const value = parts.isArbitrary
    ? parts.value
    : parts.value
      ? parts.value
      : parts.base;
  const propertyGroup = propertyGroupForNamespace(
    parts.namespace || parts.base,
    parts.value || "",
  );

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
