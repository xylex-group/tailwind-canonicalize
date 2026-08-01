import type { UtilityParts } from "./types.js";

const VARIANT_SPLIT = /:(?![^\[]*\])/; // colon not inside [...]

/**
 * Parse a single Tailwind utility token into structural parts.
 * Never throws — malformed tokens return isArbitraryProperty or empty value.
 */
export function parseUtility(token: string): UtilityParts {
  const original = token;
  let rest = token.trim();

  let important = false;
  if (rest.startsWith("!") && !rest.startsWith("![") && !rest.startsWith("!important")) {
    important = true;
    rest = rest.slice(1);
  } else if (rest.endsWith("!") && !rest.endsWith("]!")) {
    important = true;
    rest = rest.slice(0, -1);
  } else if (rest.endsWith("]!")) {
    // e.g. w-[40px]!
    important = true;
    rest = `${rest.slice(0, -1)}`;
  }

  // Split variants: hover:md:w-[40px]
  const segments = rest.split(VARIANT_SPLIT);
  let base = segments.pop() ?? rest;
  const variantParts = segments;
  const variants = variantParts.length > 0 ? `${variantParts.join(":")}:` : "";

  let negative = false;
  if (base.startsWith("-") && !base.startsWith("--") && !base.startsWith("-[")) {
    // -top-5 or -top-[20px]
    negative = true;
    base = base.slice(1);
  }

  // Arbitrary property: [mask-image:url(...)]
  if (base.startsWith("[") && base.endsWith("]") && base.includes(":")) {
    const inner = base.slice(1, -1);
    // Utility arbitrary values use property-like only when no namespace:
    // `[color:red]` is arbitrary property; `w-[40px]` is not.
    // If the entire base is [...] with a colon, it's an arbitrary property.
    if (!inner.startsWith("--") || inner.includes(":")) {
      // Distinguish `w-[40px]` style — those have a namespace prefix outside [].
      // Here base is fully `[...]`.
      const isProp = /^[a-zA-Z-]+\s*:/.test(inner) || inner.includes(":");
      if (isProp && !/^[\d.-]+/.test(inner)) {
        return {
          original,
          variants,
          important,
          base: negative ? `-${base}` : base,
          negative,
          namespace: "",
          value: base,
          isArbitrary: true,
          isArbitraryProperty: true,
        };
      }
    }
  }

  // Namespace + value
  // Patterns:
  //   w-[40px]
  //   min-w-[10rem]
  //   rounded-t-[8px]
  //   text-[#ff0000]
  //   w-10
  //   inset-x-4
  //   -translate-x-1/2 (negative already stripped)

  let namespace = "";
  let value = "";
  let isArbitrary = false;

  const arbitraryMatch = base.match(
    /^((?:[a-zA-Z]+(?:-[a-zA-Z]+)*)(?:-(?:x|y|t|b|l|r|s|e|ss|se|ee|es|tl|tr|bl|br))?)-(\[[\s\S]*\])$/,
  );
  if (arbitraryMatch) {
    namespace = arbitraryMatch[1] ?? "";
    value = arbitraryMatch[2] ?? "";
    isArbitrary = true;
  } else {
    // Named utility: split on last meaningful hyphen groups
    // e.g. min-w-full, text-red-500, w-1/2, gap-x-4
    const named = base.match(
      /^((?:[a-zA-Z]+(?:-[a-zA-Z]+)*)(?:-(?:x|y|t|b|l|r|s|e|ss|se|ee|es|tl|tr|bl|br))?)-(.+)$/,
    );
    if (named) {
      namespace = named[1] ?? "";
      value = named[2] ?? "";
    } else {
      // Bare utility with no value (e.g. "flex", "truncate")
      namespace = base;
      value = "";
    }
  }

  return {
    original,
    variants,
    important,
    base: negative ? `-${base}` : base,
    negative,
    namespace,
    value,
    isArbitrary,
    isArbitraryProperty: false,
  };
}

/**
 * Reassemble a utility from parts with a new base value suffix.
 */
export function formatUtility(
  parts: Pick<UtilityParts, "variants" | "important" | "negative" | "namespace">,
  valueSuffix: string,
): string {
  const neg = parts.negative ? "-" : "";
  const base =
    valueSuffix === ""
      ? `${neg}${parts.namespace}`
      : `${neg}${parts.namespace}-${valueSuffix}`;
  const withVariants = `${parts.variants}${base}`;
  return parts.important ? `${withVariants}!` : withVariants;
}

/**
 * Extract inner content of an arbitrary value `[...]`.
 */
export function arbitraryInner(value: string): string | null {
  if (value.startsWith("[") && value.endsWith("]")) {
    return value.slice(1, -1);
  }
  return null;
}
