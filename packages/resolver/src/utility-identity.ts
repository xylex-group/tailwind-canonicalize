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
  // bg handled in backgroundPropertyGroup (color vs clip vs position vs size)
  // text / border / flex / ring / object / font / divide handled below
  fill: "fill",
  stroke: "stroke",
  // outline / shadow handled by value-aware groups (width vs color vs style)
  from: "gradient-from",
  via: "gradient-via",
  to: "gradient-to",
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
  // Extended / design-system scales (not colors)
  "2xs",
  "3xs",
  "4xs",
  "md",
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

/** `2xs`, `3xl`, bare `xs`/`sm`/`base`/`lg`/`xl` — never text-color. */
function isFontSizeKey(value: string): boolean {
  if (!value) {
    return false;
  }
  // Strip opacity modifier: text-sm/90 is still size (rare) — color uses / on colors
  const bare = value.split("/")[0] ?? value;
  if (FONT_SIZE_KEYS.has(bare) || TEXT_TYPOGRAPHY.has(bare)) {
    return true;
  }
  // Nxs / Nxl pattern (2xs, 10xl, …)
  if (/^\d+x[sl]$/.test(bare)) {
    return true;
  }
  return false;
}

/** Tailwind palette shade steps — never font-size (e.g. text-base-500 is color). */
function isPaletteShade(value: string): boolean {
  if (!value) {
    return false;
  }
  const bare = (value.split("/")[0] ?? value).trim();
  return /^(50|100|150|200|300|400|500|600|700|800|900|950)$/.test(bare);
}

/**
 * Split text-* utilities into independent cascade slots.
 * Alignment, wrap, overflow, font-size, and color never share a group.
 *
 * Important: `text-base` is font-size, but `text-base-500` is a palette color
 * (theme color named `base`). Never classify shade suffixes as font-size.
 */
function textPropertyGroup(namespace: string, value: string): string {
  // Multi-segment: text-muted-foreground → ns text-muted + value foreground
  //                text-body-sm → ns text-body + value sm (typography scale)
  //                text-base-500 → ns text-base + value 500 (COLOR, not size)
  if (namespace.startsWith("text-") && namespace !== "text") {
    const rest = namespace.slice("text-".length);
    const full = value ? `${rest}-${value}` : rest;

    // text-red-500 / text-base-400 / text-slate-200 → color
    if (isPaletteShade(value)) {
      return "text-color";
    }

    // text-body-sm, text-caption, text-body + empty → font-size scale
    if (
      TEXT_TYPOGRAPHY.has(rest) ||
      TEXT_TYPOGRAPHY.has(full) ||
      (TEXT_TYPOGRAPHY.has(rest) && isFontSizeKey(value))
    ) {
      return "font-size";
    }

    // text-2xs already handled as ns=text value=2xs below; multi-seg size rare
    if (!value && isFontSizeKey(rest)) {
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
  // text-base, text-sm, text-2xs → size (not text-base-500 — that is multi-seg)
  if (isFontSizeKey(value)) {
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
    // Typed arbitrary: text-[length:…] / text-[font-size:…]
    if (
      inner.startsWith("length:") ||
      inner.startsWith("font-size:") ||
      inner.startsWith("--")
    ) {
      return "font-size";
    }
    // clamp/min/max and CSS lengths → font-size
    if (
      inner.startsWith("clamp(") ||
      inner.startsWith("min(") ||
      inner.startsWith("max(") ||
      /^[-+]?\d/.test(inner) ||
      inner.endsWith("px") ||
      inner.endsWith("rem") ||
      inner.endsWith("em") ||
      inner.endsWith("vw") ||
      inner.endsWith("vh") ||
      inner.endsWith("%")
    ) {
      return "font-size";
    }
  }
  // bare `text` with no value is not a color utility — skip conflict grouping
  if (!value) {
    return "plugin:text:bare";
  }
  // Design-system / mistaken weight utilities written as text-* (text-bold)
  const TEXT_AS_WEIGHT = new Set([
    "thin",
    "extralight",
    "light",
    "normal",
    "medium",
    "semibold",
    "bold",
    "extrabold",
    "black",
  ]);
  if (TEXT_AS_WEIGHT.has(value)) {
    // Prefer not clashing with text-medium as color in some themes — only map
    // unambiguous weight words that are rarely color names.
    if (value === "bold" || value === "semibold" || value === "extrabold") {
      return "font-weight";
    }
  }
  // Short type-scale aliases (text-m, text-s, text-small)
  const TEXT_SIZE_ALIASES = new Set([
    "m",
    "s",
    "l",
    "small",
    "large",
    "tiny",
    "micro",
  ]);
  if (TEXT_SIZE_ALIASES.has(value)) {
    return "font-size";
  }
  // text-black, text-foreground, text-transparent, etc.
  return "text-color";
}

const FONT_FAMILY = new Set([
  "sans",
  "serif",
  "mono",
  "body",
  "display",
  "heading",
  "code",
]);
const FONT_WEIGHT = new Set([
  "thin",
  "extralight",
  "light",
  "normal",
  "medium",
  "semibold",
  "bold",
  "extrabold",
  "black",
]);
const FONT_STRETCH = new Set([
  "ultra-condensed",
  "extra-condensed",
  "condensed",
  "semi-condensed",
  "semi-expanded",
  "expanded",
  "extra-expanded",
  "ultra-expanded",
]);
/** CSS font-size keywords (not families). font-medium stays weight via FONT_WEIGHT. */
const FONT_SIZE_CSS_KEYWORDS = new Set([
  "xx-small",
  "x-small",
  "small",
  "large",
  "x-large",
  "xx-large",
  "xxx-large",
  "smaller",
  "larger",
]);

/**
 * font-mono (family) vs font-medium (weight) never share a cascade slot.
 * font-small / font-smaller are CSS size keywords, not families.
 */
function fontPropertyGroup(namespace: string, value: string): string {
  if (namespace.startsWith("font-") && namespace !== "font") {
    // font-weight-* / multi-segment family tokens → treat rest as family name
    const rest = namespace.slice("font-".length);
    if (FONT_WEIGHT.has(rest) || /^\d{1,3}$/.test(rest)) {
      return "font-weight";
    }
    if (FONT_STRETCH.has(rest)) {
      return "font-stretch";
    }
    if (FONT_SIZE_CSS_KEYWORDS.has(rest)) {
      return "font-size";
    }
    return "font-family";
  }
  if (namespace !== "font") {
    return namespace;
  }
  if (FONT_FAMILY.has(value)) {
    return "font-family";
  }
  if (FONT_WEIGHT.has(value) || /^\d{1,3}$/.test(value)) {
    return "font-weight";
  }
  if (FONT_STRETCH.has(value)) {
    return "font-stretch";
  }
  if (FONT_SIZE_CSS_KEYWORDS.has(value)) {
    return "font-size";
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim().toLowerCase();
    if (/^\d+$/.test(inner) || inner.includes("weight")) {
      return "font-weight";
    }
    if (inner.includes("family") || /[a-z]/.test(inner)) {
      return "font-family";
    }
  }
  // Unknown named font-* (custom theme font family keys)
  return "font-family";
}

const DIVIDE_AXIS = new Set(["x", "y"]);
const DIVIDE_STYLE = new Set([
  "solid",
  "dashed",
  "dotted",
  "double",
  "none",
]);
const DIVIDE_WIDTH_KEYS = new Set(["0", "2", "4", "8"]);

/**
 * divide-y (axis) vs divide-border (color) must not conflict.
 */
function dividePropertyGroup(namespace: string, value: string): string {
  // Multi-segment colors: divide-muted + foreground, divide-red + 500
  if (namespace.startsWith("divide-") && namespace !== "divide") {
    const rest = namespace.slice("divide-".length);
    if (DIVIDE_AXIS.has(rest)) {
      // divide-x-* rarely; treat as axis width if numeric
      if (value === "" || DIVIDE_WIDTH_KEYS.has(value) || /^\d+(\.\d+)?$/.test(value)) {
        return `divide-${rest}-width`;
      }
      return `divide-${rest}-color`;
    }
    return "divide-color";
  }
  if (namespace !== "divide") {
    return namespace;
  }
  if (DIVIDE_AXIS.has(value)) {
    return `divide-${value}`;
  }
  if (DIVIDE_STYLE.has(value)) {
    return "divide-style";
  }
  if (value === "" || DIVIDE_WIDTH_KEYS.has(value) || /^\d+(\.\d+)?$/.test(value)) {
    return "divide-width";
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim().toLowerCase();
    if (
      /^[-+]?\d/.test(inner) ||
      inner.endsWith("px") ||
      inner.endsWith("rem") ||
      inner.endsWith("em")
    ) {
      return "divide-width";
    }
    return "divide-color";
  }
  // divide-border, divide-border/50, divide-red-500, …
  return "divide-color";
}

const BG_ATTACHMENT = new Set(["fixed", "local", "scroll"]);
const BG_SIZE = new Set(["auto", "cover", "contain"]);
const BG_POSITION = new Set([
  "center",
  "top",
  "bottom",
  "left",
  "right",
  "left-top",
  "left-bottom",
  "right-top",
  "right-bottom",
]);

/**
 * bg-clip-padding / bg-origin / position / size never share a slot with bg-color.
 *
 * Parse splits are uneven: `bg-clip-padding` → ns `bg-clip`, `bg-no-repeat` →
 * ns `bg-no` + value `repeat`, `bg-left-top` → ns `bg-left` + value `top`.
 */
function backgroundPropertyGroup(namespace: string, value: string): string {
  const full =
    namespace === "bg"
      ? value
      : namespace.startsWith("bg-")
        ? value
          ? `${namespace.slice("bg-".length)}-${value}`
          : namespace.slice("bg-".length)
        : value;

  // Legacy v3 opacity utilities (bg-opacity-30) — not a background-color
  if (namespace === "bg-opacity" || full === "opacity" || full.startsWith("opacity-")) {
    return "background-opacity";
  }

  if (namespace.startsWith("bg-gradient") || namespace.startsWith("bg-linear")) {
    return "background-image-gradient";
  }
  if (
    namespace === "bg-clip" ||
    full === "clip" ||
    full.startsWith("clip-") ||
    (namespace === "bg" && value.startsWith("clip-"))
  ) {
    return "background-clip";
  }
  if (namespace === "bg-origin" || full === "origin" || full.startsWith("origin-")) {
    return "background-origin";
  }
  if (namespace === "bg-blend" || full === "blend" || full.startsWith("blend-")) {
    return "background-blend-mode";
  }
  // Reconstruct common non-color utilities from split parts
  if (
    full === "no-repeat" ||
    full === "repeat" ||
    full === "repeat-x" ||
    full === "repeat-y" ||
    full === "repeat-space" ||
    full === "repeat-round" ||
    namespace === "bg-repeat" ||
    namespace === "bg-no"
  ) {
    return "background-repeat";
  }
  if (BG_ATTACHMENT.has(full) || (namespace === "bg" && BG_ATTACHMENT.has(value))) {
    return "background-attachment";
  }
  if (BG_SIZE.has(full) || (namespace === "bg" && BG_SIZE.has(value))) {
    return "background-size";
  }
  if (
    BG_POSITION.has(full) ||
    namespace === "bg-left" ||
    namespace === "bg-right" ||
    (namespace === "bg" && BG_POSITION.has(value))
  ) {
    return "background-position";
  }
  if (full === "none" || (namespace === "bg" && value === "none")) {
    return "background-image";
  }
  return "background-color";
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
// "px" is the named 1px width (border-px); sm/md/lg used by design systems as width
const BORDER_WIDTH_KEYS = new Set([
  "0",
  "2",
  "4",
  "8",
  "px",
  "sm",
  "md",
  "lg",
  "xl",
  "small",
  "medium",
  "large",
  "thin",
  "thick",
]);
const BORDER_SIDE_LONG = new Set(["top", "right", "bottom", "left"]);

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

const BORDER_COLLAPSE = new Set(["collapse", "separate"]);

/**
 * Split border width / style / color / sides into independent cascade slots.
 * `border` + `border-border` must not conflict (width vs color).
 * `border-collapse` is table layout, not border-color.
 */
function borderPropertyGroup(namespace: string, value: string): string {
  // border-spacing handled elsewhere
  if (namespace.startsWith("border-spacing")) {
    return namespace;
  }

  // border-collapse / border-separate (table border-collapse)
  if (namespace === "border" && BORDER_COLLAPSE.has(value)) {
    return "border-collapse";
  }
  if (namespace === "border-collapse" || namespace === "border-separate") {
    return "border-collapse";
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

  // Multi-segment: border-red + 500, border-bottom + color, border-muted + foreground
  if (namespace.startsWith("border-")) {
    const rest = namespace.slice("border-".length);
    const first = rest.split("-")[0] ?? "";
    // Long-form CSS-ish: border-bottom-color / border-left-color (independent sides)
    if (BORDER_SIDE_LONG.has(first)) {
      if (value === "color" || rest.endsWith("-color") || rest === `${first}-color`) {
        return `border-${first}-color`;
      }
      if (isBorderWidthValue(value) || value === "") {
        return `border-${first}-width`;
      }
      if (BORDER_STYLE.has(value)) {
        return `border-${first}-style`;
      }
      return `border-${first}-color`;
    }
    if (BORDER_SIDE.has(first)) {
      // border-t-red / border-t-2 already handled via sideMatch when ns is border-t
      return `border-${first}-color`;
    }
    return "border-color";
  }

  return "border-color";
}


const OBJECT_FIT = new Set([
  "contain",
  "cover",
  "fill",
  "none",
  "scale-down",
]);
const OBJECT_POSITION = new Set([
  "center",
  "top",
  "bottom",
  "left",
  "right",
  "left-top",
  "left-bottom",
  "right-top",
  "right-bottom",
]);

/**
 * object-cover (fit) vs object-center (position) never share a cascade slot.
 */
function objectPropertyGroup(namespace: string, value: string): string {
  if (namespace.startsWith("object-") && namespace !== "object") {
    const rest = namespace.slice("object-".length);
    const full = value ? `${rest}-${value}` : rest;
    if (OBJECT_FIT.has(rest) || OBJECT_FIT.has(full)) {
      return "object-fit";
    }
    if (OBJECT_POSITION.has(rest) || OBJECT_POSITION.has(full)) {
      return "object-position";
    }
    // object-left + top → position
    if (namespace === "object-left" || namespace === "object-right") {
      return "object-position";
    }
    return "object-position";
  }
  if (namespace !== "object") {
    return namespace;
  }
  if (OBJECT_FIT.has(value)) {
    return "object-fit";
  }
  if (OBJECT_POSITION.has(value)) {
    return "object-position";
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    // arbitrary — could be either; prefer position for length pairs, fit otherwise
    const inner = value.slice(1, -1).trim().toLowerCase();
    if (inner.includes(" ") || inner.includes("%") || inner.includes("px")) {
      return "object-position";
    }
    return "object-fit";
  }
  return "object-fit";
}

const RING_WIDTH_KEYS = new Set(["0", "1", "2", "4", "8"]);

function ringPropertyGroup(namespace: string, value: string): string {
  // Legacy v3 ring-opacity-* (not a ring color)
  if (namespace === "ring-opacity" || namespace.startsWith("ring-opacity")) {
    return "ring-opacity";
  }
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
const OUTLINE_WIDTH = new Set(["0", "1", "2", "4", "8"]);
const OUTLINE_STYLE = new Set([
  "none",
  "solid",
  "dashed",
  "dotted",
  "double",
  "hidden",
]);

/**
 * outline-1 (width) vs outline-ring (color) never share a cascade slot.
 * outline-hidden / outline-none are style; outline-0 is width.
 */
function outlinePropertyGroup(namespace: string, value: string): string {
  if (namespace === "outline-offset" || namespace.startsWith("outline-offset")) {
    return "outline-offset";
  }
  if (namespace.startsWith("outline-") && namespace !== "outline") {
    // outline-red + 500 → color
    return "outline-color";
  }
  if (namespace !== "outline") {
    return namespace;
  }
  // bare `outline` enables default outline style (TW utility)
  if (value === "") {
    return "outline-style";
  }
  if (OUTLINE_STYLE.has(value)) {
    return "outline-style";
  }
  if (OUTLINE_WIDTH.has(value) || /^\d+(\.\d+)?$/.test(value)) {
    return "outline-width";
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim().toLowerCase();
    if (
      inner.startsWith("#") ||
      inner.startsWith("rgb") ||
      inner.startsWith("hsl") ||
      inner.startsWith("oklch") ||
      inner.startsWith("var(")
    ) {
      return "outline-color";
    }
    if (
      /^[-+]?\d/.test(inner) ||
      inner.endsWith("px") ||
      inner.endsWith("rem")
    ) {
      return "outline-width";
    }
  }
  // outline-ring, outline-primary, …
  return "outline-color";
}

const SHADOW_SIZE = new Set([
  "none",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "inner",
]);

/**
 * shadow-sm (elevation) vs shadow-border/10 (color) never share a slot.
 * Named elevations (incl. custom numeric theme keys like shadow-600) share size.
 */
function shadowPropertyGroup(namespace: string, value: string): string {
  if (namespace.startsWith("shadow-") && namespace !== "shadow") {
    // shadow-red + 500, shadow-border handled as multi-seg color-ish
    const rest = namespace.slice("shadow-".length);
    if (SHADOW_SIZE.has(rest)) {
      return "box-shadow";
    }
    return "box-shadow-color";
  }
  if (namespace !== "shadow") {
    return namespace;
  }
  if (!value || SHADOW_SIZE.has(value)) {
    return "box-shadow";
  }
  // opacity modifier on a size is rare; slash usually means color token
  if (value.includes("/")) {
    return "box-shadow-color";
  }
  // numeric theme keys (shadow-600) → elevation slot
  if (/^\d+(\.\d+)?$/.test(value)) {
    return "box-shadow";
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim().toLowerCase();
    if (
      inner.startsWith("#") ||
      inner.startsWith("rgb") ||
      inner.startsWith("hsl") ||
      inner.startsWith("oklch") ||
      inner.startsWith("color(")
    ) {
      return "box-shadow-color";
    }
    return "box-shadow";
  }
  // shadow-border, shadow-primary (color names without shade in value)
  // Heuristic: known sizes only above; everything else with a letter → color
  if (/[a-z]/i.test(value) && !SHADOW_SIZE.has(value)) {
    return "box-shadow-color";
  }
  return "box-shadow";
}

const OVERFLOW_VALUES = new Set([
  "auto",
  "hidden",
  "clip",
  "visible",
  "scroll",
  "ellipsis", // text-overflow sometimes aliased; keep out of custom
]);

/**
 * Standard overflow-* share a slot; unknown values (overflow-stable, …) are
 * treated as plugin utilities so they don't false-conflict with overflow-auto.
 */
function overflowPropertyGroup(namespace: string, value: string): string {
  if (namespace === "overflow-x" || namespace.startsWith("overflow-x")) {
    return "overflow-x";
  }
  if (namespace === "overflow-y" || namespace.startsWith("overflow-y")) {
    return "overflow-y";
  }
  if (namespace.startsWith("overflow-") && namespace !== "overflow") {
    const rest = namespace.slice("overflow-".length);
    if (OVERFLOW_VALUES.has(rest) || rest === "x" || rest === "y") {
      return namespace;
    }
    return `plugin:overflow:${rest}${value ? `:${value}` : ""}`;
  }
  if (namespace !== "overflow") {
    return namespace;
  }
  if (!value || OVERFLOW_VALUES.has(value)) {
    return "overflow";
  }
  // overflow-stable and other custom @utility names
  return `plugin:overflow:${value}`;
}

const GRID_FLOW = new Set(["row", "col", "dense", "row-dense", "col-dense"]);

/**
 * display:grid vs grid-cols-* vs custom @utility grid-tables never share a slot.
 */
function gridPropertyGroup(namespace: string, value: string): string {
  if (namespace === "grid-cols" || namespace.startsWith("grid-cols")) {
    return "grid-template-columns";
  }
  if (namespace === "grid-rows" || namespace.startsWith("grid-rows")) {
    return "grid-template-rows";
  }
  if (namespace === "grid-flow" || namespace.startsWith("grid-flow")) {
    return "grid-auto-flow";
  }
  if (namespace === "grid-areas" || namespace.startsWith("grid-areas")) {
    return "grid-template-areas";
  }
  if (namespace.startsWith("grid-") && namespace !== "grid") {
    // grid-tables as ns? unlikely; custom multi-seg → plugin
    return `plugin:${namespace}${value ? `:${value}` : ""}`;
  }
  if (namespace !== "grid") {
    return namespace;
  }
  // bare `grid` / `inline` → display
  if (value === "" || value === "inline") {
    return "display";
  }
  if (GRID_FLOW.has(value)) {
    return "grid-auto-flow";
  }
  // Custom @utility grid-tables, grid-kpis, …
  return `plugin:grid:${value}`;
}

const LIST_STYLE_TYPE = new Set([
  "none",
  "disc",
  "decimal",
  "decimal-leading-zero",
  "lower-roman",
  "upper-roman",
  "lower-greek",
  "lower-alpha",
  "lower-latin",
  "upper-alpha",
  "upper-latin",
  "square",
  "circle",
]);
const LIST_STYLE_POSITION = new Set(["inside", "outside"]);

/**
 * list-disc (type) vs list-inside (position) never share a cascade slot.
 */
function listPropertyGroup(namespace: string, value: string): string {
  if (namespace === "list-image" || namespace.startsWith("list-image")) {
    return "list-style-image";
  }
  if (namespace.startsWith("list-") && namespace !== "list") {
    const rest = namespace.slice("list-".length);
    if (LIST_STYLE_POSITION.has(rest)) {
      return "list-style-position";
    }
    if (LIST_STYLE_TYPE.has(rest) || rest === "item") {
      return rest === "item" ? "display" : "list-style-type";
    }
    return "list-style-type";
  }
  if (namespace !== "list") {
    return namespace;
  }
  if (LIST_STYLE_POSITION.has(value)) {
    return "list-style-position";
  }
  if (LIST_STYLE_TYPE.has(value)) {
    return "list-style-type";
  }
  if (value === "item") {
    return "display"; // list-item
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    return "list-style-type";
  }
  return "list-style-type";
}

/**
 * Namespaces that intentionally compete on a shared cascade slot when the
 * value differs (width scale, color scale, etc.). Everything else (iconify
 * `icon` + `icon-tabler`, custom plugins) gets a unique group per full utility
 * so co-occurring plugin classes are not false-positive conflicts.
 */
const KNOWN_COMPETING_NAMESPACES = new Set([
  ...Object.keys(PROPERTY_GROUPS),
  "text",
  "font",
  "divide",
  "flex",
  "grow",
  "shrink",
  "basis",
  "border",
  "ring",
  "bg",
  "object",
  "from",
  "via",
  "to",
  "fill",
  "stroke",
  "rounded",
  "outline",
  "shadow",
  "opacity",
  "z",
  "order",
  "col",
  "row",
  "grid",
  "list",
  "list-image",
  "decoration",
  "underline",
  "overline",
  "line",
  "align",
  "whitespace",
  "break",
  "hyphens",
  "content",
  "accent",
  "caret",
  "scroll",
  "snap",
  "touch",
  "select",
  "will",
  "cursor",
  "pointer",
  "resize",
  "scroll",
  "appearance",
  "columns",
  "break",
  "box",
  "float",
  "clear",
  "isolate",
  "isolation",
  "object",
  "overflow",
  "overscroll",
  "position",
  "inset",
  "visible",
  "invisible",
  "collapse",
  "static",
  "fixed",
  "absolute",
  "relative",
  "sticky",
]);

function isKnownCompetingNamespace(namespace: string): boolean {
  if (!namespace) {
    return false;
  }
  if (KNOWN_COMPETING_NAMESPACES.has(namespace)) {
    return true;
  }
  // prefix families: text-*, border-*, bg-*, etc.
  const head = namespace.split("-")[0] ?? namespace;
  if (KNOWN_COMPETING_NAMESPACES.has(head)) {
    return true;
  }
  if (
    namespace.startsWith("text-") ||
    namespace.startsWith("font-") ||
    namespace.startsWith("divide-") ||
    namespace.startsWith("flex-") ||
    namespace.startsWith("border-") ||
    namespace.startsWith("ring-") ||
    namespace.startsWith("bg-") ||
    namespace.startsWith("object-") ||
    namespace.startsWith("from-") ||
    namespace.startsWith("via-") ||
    namespace.startsWith("to-") ||
    namespace.startsWith("fill-") ||
    namespace.startsWith("stroke-") ||
    namespace.startsWith("rounded-") ||
    namespace.startsWith("scroll-") ||
    namespace.startsWith("min-") ||
    namespace.startsWith("max-") ||
    namespace.startsWith("gap-") ||
    namespace.startsWith("space-") ||
    namespace.startsWith("translate-") ||
    namespace.startsWith("scale-") ||
    namespace.startsWith("rotate-") ||
    namespace.startsWith("skew-") ||
    namespace.startsWith("origin-") ||
    namespace.startsWith("place-") ||
    namespace.startsWith("justify-") ||
    namespace.startsWith("items-") ||
    namespace.startsWith("self-") ||
    namespace.startsWith("content-") ||
    namespace.startsWith("backdrop-") ||
    namespace.startsWith("drop-") ||
    namespace.startsWith("mix-") ||
    namespace.startsWith("outline-") ||
    namespace.startsWith("decoration-") ||
    namespace.startsWith("underline-") ||
    namespace.startsWith("list-") ||
    namespace.startsWith("grid-") ||
    namespace.startsWith("auto-") ||
    namespace.startsWith("col-") ||
    namespace.startsWith("row-") ||
    namespace.startsWith("aspect-") ||
    namespace.startsWith("columns-")
  ) {
    return true;
  }
  return false;
}

export function propertyGroupForNamespace(namespace: string, value = ""): string {
  // text / flex / border / ring / font / divide / bg / object need value-aware classification
  if (namespace === "text" || namespace.startsWith("text-")) {
    return textPropertyGroup(namespace, value);
  }
  if (namespace === "font" || namespace.startsWith("font-")) {
    return fontPropertyGroup(namespace, value);
  }
  if (namespace === "divide" || namespace.startsWith("divide-")) {
    return dividePropertyGroup(namespace, value);
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
  if (namespace === "object" || namespace.startsWith("object-")) {
    return objectPropertyGroup(namespace, value);
  }
  if (namespace === "list" || namespace.startsWith("list-")) {
    return listPropertyGroup(namespace, value);
  }
  if (namespace === "outline" || namespace.startsWith("outline-")) {
    return outlinePropertyGroup(namespace, value);
  }
  if (namespace === "shadow" || namespace.startsWith("shadow-")) {
    return shadowPropertyGroup(namespace, value);
  }
  if (namespace === "overflow" || namespace.startsWith("overflow-")) {
    return overflowPropertyGroup(namespace, value);
  }
  if (namespace === "grid" || namespace.startsWith("grid-")) {
    return gridPropertyGroup(namespace, value);
  }
  if (namespace === "bg" || namespace.startsWith("bg-")) {
    return backgroundPropertyGroup(namespace, value);
  }
  // Legacy v3 *‑opacity utilities
  if (namespace === "text-opacity") {
    return "text-opacity";
  }
  if (namespace === "border-opacity") {
    return "border-opacity";
  }
  if (namespace === "ring-opacity") {
    return "ring-opacity";
  }
  if (namespace === "divide-opacity") {
    return "divide-opacity";
  }
  if (namespace === "placeholder-opacity") {
    return "placeholder-opacity";
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

  // Unknown / plugin utilities (icon, icon-tabler, btn-primary, …): do not
  // treat prefix siblings as competing cascade slots.
  if (!isKnownCompetingNamespace(namespace)) {
    return value
      ? `plugin:${namespace}:${value}`
      : `plugin:${namespace || "unknown"}`;
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
