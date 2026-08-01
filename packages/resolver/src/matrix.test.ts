import { describe, expect, it } from "vitest";
import { createDefaultTheme } from "./default-theme.js";
import { findCanonicalEquivalent } from "./find-canonical.js";
import { resolveSpacingMultiplier } from "./length.js";

/**
 * Matrix coverage: every default numeric spacing key should round-trip
 * from its resolved CSS length back to the same scale key.
 */
describe("spacing matrix", () => {
  const theme = createDefaultTheme();
  const unit = theme.spacingUnit;
  if (!unit) {
    throw new Error("missing spacing unit");
  }

  const keys = [
    0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20,
    24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96,
  ];

  const namespaces = [
    "w",
    "h",
    "p",
    "px",
    "py",
    "pt",
    "m",
    "mx",
    "gap",
    "gap-x",
    "min-w",
    "min-h",
    "max-w",
    "inset",
    "top",
    "size",
  ];

  for (const ns of namespaces) {
    for (const key of keys) {
      const css = resolveSpacingMultiplier(key, unit);
      const token = `${ns}-[${css}]`;
      it(`${token} → ${ns}-${key}`, () => {
        const match = findCanonicalEquivalent(token, { theme });
        expect(match?.canonical).toBe(`${ns}-${key}`);
      });
    }
  }
});

describe("keyword matrix", () => {
  const theme = createDefaultTheme();
  const cases: Array<[string, string]> = [
    ["w-[100%]", "w-full"],
    ["w-[auto]", "w-auto"],
    ["w-[fit-content]", "w-fit"],
    ["w-[max-content]", "w-max"],
    ["w-[min-content]", "w-min"],
    ["h-[100%]", "h-full"],
    ["h-[100vh]", "h-screen"],
    ["h-[100svh]", "h-svh"],
    ["h-[100dvh]", "h-dvh"],
    ["h-[100lvh]", "h-lvh"],
    ["size-[100%]", "size-full"],
    ["min-w-[100%]", "min-w-full"],
    ["max-h-[100vh]", "max-h-screen"],
    ["w-[50%]", "w-1/2"],
    ["w-[25%]", "w-1/4"],
    ["w-[75%]", "w-3/4"],
    ["w-[33.333333%]", "w-1/3"],
    ["w-[66.666667%]", "w-2/3"],
  ];

  for (const [from, to] of cases) {
    it(`${from} → ${to}`, () => {
      expect(findCanonicalEquivalent(from, { theme })?.canonical).toBe(to);
    });
  }
});

describe("continuous spacing matrix", () => {
  const theme = createDefaultTheme();
  const unit = theme.spacingUnit;
  if (!unit) {
    throw new Error("missing spacing unit");
  }

  // Keys beyond the classic discrete table — exact --spacing multiples only
  const continuousKeys = [
    3.25, 25, 35, 50, 62.5, 65, 75, 120, 140, 160, 310,
  ];
  const namespaces = ["w", "h", "min-w", "max-w", "max-h", "size"];

  for (const ns of namespaces) {
    for (const key of continuousKeys) {
      const css = resolveSpacingMultiplier(key, unit);
      const token = `${ns}-[${css}]`;
      it(`${token} → ${ns}-${key}`, () => {
        const match = findCanonicalEquivalent(token, { theme });
        expect(match?.canonical).toBe(`${ns}-${key}`);
      });
    }
  }
});

describe("variant matrix", () => {
  const theme = createDefaultTheme();
  const variants = [
    "hover:",
    "focus:",
    "md:",
    "lg:",
    "xl:",
    "2xl:",
    "dark:",
    "hover:md:",
    "md:hover:",
    "group-hover:",
    "peer-focus:",
    "motion-safe:",
    "aria-disabled:",
    "data-open:",
    "supports-backdrop-filter:",
  ];

  for (const v of variants) {
    it(`preserves ${v}`, () => {
      const match = findCanonicalEquivalent(`${v}w-[40px]`, { theme });
      expect(match?.canonical).toBe(`${v}w-10`);
    });
  }
});

describe("safety matrix", () => {
  const theme = createDefaultTheme();
  const leave = [
    "w-[10vh]",
    "w-[10vw]",
    "w-[calc(100%-1rem)]",
    "w-[var(--x)]",
    "w-[min(100%,40px)]",
    "w-[max(10px,1rem)]",
    "w-[clamp(1rem,2vw,2rem)]",
    "[mask-image:url(/a.png)]",
    "[animation:spin_1s_linear_infinite]",
    "flex",
    "w-10",
    "text-[length:var(--x)]",
  ];

  for (const token of leave) {
    it(`does not rewrite ${token}`, () => {
      expect(findCanonicalEquivalent(token, { theme })).toBeNull();
    });
  }
});
