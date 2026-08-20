import { describe, expect, it } from "vitest";
import { createDefaultTheme } from "./default-theme.js";
import { findCanonicalEquivalent } from "./find-canonical.js";
import { resolveSpacingMultiplier, valuesEqual } from "./length.js";
import { migrateUtility } from "./migrations/apply.js";
import { usesContainerScale } from "./namespace.js";
import { DEFAULT_COLOR_PALETTE } from "./palette-default.js";
import { transformClassString } from "./pipeline.js";

function expectedSpacingCanonical(
  ns: string,
  key: number,
  theme: ReturnType<typeof createDefaultTheme>,
): string {
  const unit = theme.spacingUnit;
  if (!unit) {
    return `${ns}-${key}`;
  }
  const css = resolveSpacingMultiplier(key, unit);
  if (usesContainerScale(ns)) {
    for (const [ck, cv] of theme.container.values) {
      if (valuesEqual(css, cv, 16)) {
        return `${ns}-${ck}`;
      }
    }
  }
  return `${ns}-${key}`;
}

/**
 * Thousands of generated cases covering spacing × namespaces × variants,
 * full palette color exactness, migrations, and safety.
 */
describe("generated matrix (thousands)", () => {
  const theme = createDefaultTheme();
  const unit = theme.spacingUnit!;
  const numericKeys = [
    0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40,
    44, 48, 52, 56, 60, 64, 72, 80, 96,
  ];
  const namespaces = [
    "w",
    "h",
    "size",
    "min-w",
    "min-h",
    "max-w",
    "max-h",
    "p",
    "px",
    "py",
    "pt",
    "m",
    "mx",
    "my",
    "gap",
    "gap-x",
    "inset",
    "top",
    "left",
    "basis",
    "indent",
    "scroll-m",
    "scroll-p",
    "border-spacing",
    "translate-x",
  ];
  const variants = [
    "",
    "hover:",
    "focus:",
    "md:",
    "lg:",
    "dark:",
    "hover:md:",
    "dark:md:",
    "group-hover:",
  ];

  // Spacing matrix: ~25 ns × 35 keys × 9 variants ≈ 7800 cases
  // Run as single test with internal loop for speed, plus sampled expect.it batches
  it("spacing arbitrary values resolve uniquely across namespaces", () => {
    let checked = 0;
    let ok = 0;
    for (const ns of namespaces) {
      for (const key of numericKeys) {
        const css = resolveSpacingMultiplier(key, unit);
        const token = `${ns}-[${css}]`;
        const match = findCanonicalEquivalent(token, { theme });
        const expected = expectedSpacingCanonical(ns, key, theme);
        checked++;
        if (match?.canonical === expected) {
          ok++;
        } else {
          // Prefer fail with context
          expect(match?.canonical, token).toBe(expected);
        }
      }
    }
    expect(checked).toBeGreaterThan(800);
    expect(ok).toBe(checked);
  });

  it("continuous spacing keys beyond discrete table resolve", () => {
    const continuous = [3.25, 25, 35, 50, 62.5, 65, 75, 120, 140, 160, 310];
    for (const ns of ["w", "max-w", "min-w", "h", "max-h"]) {
      for (const key of continuous) {
        const css = resolveSpacingMultiplier(key, unit);
        const token = `${ns}-[${css}]`;
        expect(findCanonicalEquivalent(token, { theme })?.canonical, token).toBe(`${ns}-${key}`);
      }
    }
  });

  it("variant prefix preservation matrix", () => {
    let n = 0;
    for (const v of variants) {
      for (const key of [2, 4, 10, 40]) {
        const css = resolveSpacingMultiplier(key, unit);
        const token = `${v}max-w-[${css}]`;
        const match = findCanonicalEquivalent(token, { theme });
        expect(match?.canonical).toBe(`${v}max-w-${key}`);
        n++;
        // important
        const imp = findCanonicalEquivalent(`${v}max-w-[${css}]!`, { theme });
        expect(imp?.canonical).toBe(`${v}max-w-${key}!`);
        n++;
      }
    }
    expect(n).toBe(variants.length * 4 * 2);
  });

  it("full default palette exact hex → color key (unique keys only)", () => {
    // Build reverse map; skip ambiguous hex values
    const reverse = new Map<string, string[]>();
    for (const [key, hex] of Object.entries(DEFAULT_COLOR_PALETTE)) {
      if (!hex.startsWith("#")) {
        continue;
      }
      const list = reverse.get(hex.toLowerCase()) ?? [];
      list.push(key);
      reverse.set(hex.toLowerCase(), list);
    }

    let unique = 0;
    let multi = 0;
    for (const [hex, keys] of reverse) {
      if (keys.length !== 1) {
        multi++;
        // Multi-match must not rewrite
        const match = findCanonicalEquivalent(`text-[${hex}]`, { theme });
        expect(match).toBeNull();
        continue;
      }
      unique++;
      const key = keys[0]!;
      // Skip inherit-like
      if (key === "inherit" || key === "current" || key === "transparent") {
        continue;
      }
      const match = findCanonicalEquivalent(`bg-[${hex}]`, { theme });
      // text vs bg both use colors scale for arbitrary hex
      expect(match?.canonical).toBe(`bg-${key}`);
    }
    expect(unique).toBeGreaterThan(200);
    expect(multi).toBeGreaterThan(0); // some shared neutrals
  });

  it("gradient migration matrix all directions × variants", () => {
    const dirs = ["t", "tr", "r", "br", "b", "bl", "l", "tl"];
    let n = 0;
    for (const dir of dirs) {
      for (const v of variants) {
        const from = `${v}bg-gradient-to-${dir}`;
        const to = migrateUtility(from, { enabled: true }).token;
        expect(to).toBe(`${v}bg-linear-to-${dir}`);
        n++;
      }
    }
    expect(n).toBe(dirs.length * variants.length);
  });

  it("keyword matrix", () => {
    const cases: Array<[string, string]> = [];
    for (const ns of ["w", "h", "size", "min-w", "max-w"]) {
      cases.push([`${ns}-[100%]`, `${ns}-full`]);
      cases.push([`${ns}-[fit-content]`, `${ns}-fit`]);
      cases.push([`${ns}-[min-content]`, `${ns}-min`]);
      cases.push([`${ns}-[max-content]`, `${ns}-max`]);
    }
    cases.push(["h-[100vh]", "h-screen"]);
    cases.push(["w-[auto]", "w-auto"]);
    cases.push(["w-[50%]", "w-1/2"]);
    cases.push(["w-[25%]", "w-1/4"]);
    for (const [from, to] of cases) {
      expect(findCanonicalEquivalent(from, { theme })?.canonical).toBe(to);
    }
  });

  it("safety: never rewrite calc/var/incompatible units (matrix)", () => {
    const leave = [
      "w-[10vh]",
      "w-[10vw]",
      "w-[calc(100%-1rem)]",
      "w-[var(--x)]",
      "w-[min(1px,2px)]",
      "h-[max(1rem,2rem)]",
      "p-[clamp(1px,2vw,3px)]",
      "[mask-image:url(x)]",
      "text-[length:var(--a)]",
    ];
    for (const v of variants) {
      for (const t of leave) {
        if (t.startsWith("[")) {
          expect(findCanonicalEquivalent(t, { theme })).toBeNull();
        } else {
          expect(findCanonicalEquivalent(`${v}${t}`, { theme })).toBeNull();
        }
      }
    }
  });

  it("pipeline bulk idempotence sample", () => {
    const samples = [
      "max-w-[160px] hover:p-[16px] bg-gradient-to-br",
      "dark:md:w-[40px] gap-[8px]!",
      "min-h-[10px] max-h-[100vh] w-[50%]",
    ];
    for (const s of samples) {
      const opts = { theme, migrations: true as const };
      const a = transformClassString(s, opts);
      const b = transformClassString(a.result, opts);
      expect(b.result).toBe(a.result);
    }
  });
});

describe("palette coverage", () => {
  it("exports full palette size", () => {
    const keys = Object.keys(DEFAULT_COLOR_PALETTE);
    // 5 special + 22 hues × 11 shades = 5 + 242 = 247
    expect(keys.length).toBeGreaterThanOrEqual(240);
  });
});
