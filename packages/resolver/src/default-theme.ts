import { parseLength, resolveSpacingMultiplier } from "./length.js";
import { defaultColorScale } from "./palette-default.js";
import type { Theme, ThemeScale } from "./types.js";

function scale(entries: Record<string, string>): ThemeScale {
  return { values: new Map(Object.entries(entries)) };
}

/**
 * Tailwind CSS v4 default theme tokens used when no project CSS is loaded.
 *
 * Values mirror the public default theme. Projects should prefer loading
 * actual `@theme` configuration via `loadThemeFromCss`.
 */
export function createDefaultTheme(): Theme {
  const spacingUnit = parseLength("0.25rem");
  const spacingValues = new Map<string, string>();

  // Numeric scale 0–96 (common subset) + fractions handled separately
  const numericKeys = [
    0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40,
    44, 48, 52, 56, 60, 64, 72, 80, 96,
  ];

  if (spacingUnit) {
    for (const key of numericKeys) {
      const label = String(key);
      spacingValues.set(label, resolveSpacingMultiplier(key, spacingUnit));
    }
  }

  // Keyword size utilities shared by width/height/etc.
  const sizeKeywords: Record<string, string> = {
    auto: "auto",
    full: "100%",
    screen: "100vh",
    svh: "100svh",
    lvh: "100lvh",
    dvh: "100dvh",
    min: "min-content",
    max: "max-content",
    fit: "fit-content",
    px: "1px",
  };

  for (const [k, v] of Object.entries(sizeKeywords)) {
    spacingValues.set(k, v);
  }

  // Fractions commonly used for width/height
  const fractions: Record<string, string> = {
    "1/2": "50%",
    "1/3": "33.333333%",
    "2/3": "66.666667%",
    "1/4": "25%",
    "2/4": "50%",
    "3/4": "75%",
    "1/5": "20%",
    "2/5": "40%",
    "3/5": "60%",
    "4/5": "80%",
    "1/6": "16.666667%",
    "5/6": "83.333333%",
    "1/12": "8.333333%",
    "5/12": "41.666667%",
    "7/12": "58.333333%",
    "11/12": "91.666667%",
  };
  for (const [k, v] of Object.entries(fractions)) {
    spacingValues.set(k, v);
  }

  // Named radius tokens only. Numeric `rounded-*` spacing multipliers are
  // intentionally omitted from defaults so `rounded-[8px]` → `rounded-lg`
  // is unambiguous. Projects that define custom --radius-* still load them.
  const radius = scale({
    none: "0px",
    sm: "0.125rem",
    DEFAULT: "0.25rem",
    md: "0.375rem",
    lg: "0.5rem",
    xl: "0.75rem",
    "2xl": "1rem",
    "3xl": "1.5rem",
    full: "9999px",
  });

  const fontSize = scale({
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.25rem",
    "5xl": "3rem",
    "6xl": "3.75rem",
    "7xl": "4.5rem",
    "8xl": "6rem",
    "9xl": "8rem",
  });

  const lineHeight = scale({
    none: "1",
    tight: "1.25",
    snug: "1.375",
    normal: "1.5",
    relaxed: "1.625",
    loose: "2",
  });
  if (spacingUnit) {
    for (const key of numericKeys) {
      lineHeight.values.set(String(key), resolveSpacingMultiplier(key, spacingUnit));
    }
  }

  const letterSpacing = scale({
    tighter: "-0.05em",
    tight: "-0.025em",
    normal: "0em",
    wide: "0.025em",
    wider: "0.05em",
    widest: "0.1em",
  });

  const blur = scale({
    none: "0",
    sm: "4px",
    DEFAULT: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    "2xl": "40px",
    "3xl": "64px",
  });

  const boxShadow = scale({
    "2xs": "0 1px rgb(0 0 0 / 0.05)",
    xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    sm: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
    DEFAULT: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
    "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
    none: "0 0 #0000",
    inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
  });

  const opacity = scale({
    "0": "0",
    "5": "0.05",
    "10": "0.1",
    "15": "0.15",
    "20": "0.2",
    "25": "0.25",
    "30": "0.3",
    "35": "0.35",
    "40": "0.4",
    "45": "0.45",
    "50": "0.5",
    "55": "0.55",
    "60": "0.6",
    "65": "0.65",
    "70": "0.7",
    "75": "0.75",
    "80": "0.8",
    "85": "0.85",
    "90": "0.9",
    "95": "0.95",
    "100": "1",
  });

  // Full default palette — exact hex match only.
  const colors = { values: defaultColorScale() };

  // Tailwind v4 --container-* (used by min-w / max-w / w / size / basis).
  const container = scale({
    "3xs": "16rem",
    "2xs": "18rem",
    xs: "20rem",
    sm: "24rem",
    md: "28rem",
    lg: "32rem",
    xl: "36rem",
    "2xl": "42rem",
    "3xl": "48rem",
    "4xl": "56rem",
    "5xl": "64rem",
    "6xl": "72rem",
    "7xl": "80rem",
  });

  // Tailwind border-width scale: bare numbers are CSS px, NOT --spacing units.
  // border-2 = 2px; border-8 = 8px. Never map 8px → border-2 (spacing).
  const borderWidth = scale({
    0: "0px",
    DEFAULT: "1px",
    px: "1px",
    2: "2px",
    4: "4px",
    8: "8px",
  });

  return {
    spacingUnit,
    spacing: { values: spacingValues },
    colors,
    borderWidth,
    borderRadius: radius,
    fontSize,
    lineHeight,
    letterSpacing,
    blur,
    boxShadow,
    opacity,
    width: { values: new Map(spacingValues) },
    height: { values: new Map(spacingValues) },
    container,
    cssVariables: new Map([["--spacing", "0.25rem"]]),
    source: "default",
    tailwindVersion: 4,
  };
}
