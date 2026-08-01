import { describe, expect, it } from "vitest";
import { createDefaultTheme } from "./default-theme.js";
import { findCanonicalEquivalent } from "./find-canonical.js";
import { invertSpacingMultiplier, parseLength } from "./length.js";
import { transformClassString } from "./pipeline.js";
import type { Theme } from "./types.js";
import { utilitiesConflict, utilityIdentity } from "./utility-identity.js";

function v3ThemeLike(): Theme {
  const theme = createDefaultTheme();
  theme.tailwindVersion = 3;
  return theme;
}

describe("PR #2 review fixes", () => {
  it("P1: Resolve named easing against the active theme", () => {
    // Original found case: override --ease-in-out must not rewrite bezier to ease-in-out
    const theme = createDefaultTheme();
    theme.cssVariables.set("--ease-in-out", "cubic-bezier(0.1,0.2,0.3,0.4)");
    expect(
      findCanonicalEquivalent("ease-[cubic-bezier(0.4,0,0.2,1)]", { theme }),
    ).toBeNull();

    // Default theme (no override) still rewrites
    const defaults = createDefaultTheme();
    expect(
      findCanonicalEquivalent("ease-[cubic-bezier(0.4,0,0.2,1)]", {
        theme: defaults,
      })?.canonical,
    ).toBe("ease-in-out");

    // Override that matches the arbitrary value still rewrites
    theme.cssVariables.set(
      "--ease-in-out",
      "cubic-bezier(0.4, 0, 0.2, 1)",
    );
    expect(
      findCanonicalEquivalent("ease-[cubic-bezier(0.4,0,0.2,1)]", { theme })
        ?.canonical,
    ).toBe("ease-in-out");
  });

  it("P1: Gate bare z-index synthesis on Tailwind v4", () => {
    // Original found case: v3 theme must not rewrite z-[5] → z-5
    const v3 = v3ThemeLike();
    expect(findCanonicalEquivalent("z-[5]", { theme: v3 })).toBeNull();

    // v4 still synthesizes bare integer z utilities
    const v4 = createDefaultTheme();
    expect(findCanonicalEquivalent("z-[5]", { theme: v4 })?.canonical).toBe(
      "z-5",
    );
    // auto keyword remains safe on both
    expect(findCanonicalEquivalent("z-[auto]", { theme: v3 })?.canonical).toBe(
      "z-auto",
    );
  });

  it("P2: Reject context-relative spacing during absolute inversion", () => {
    // Original found case: --spacing: 0.25em must not invert w-[140px] → w-35
    const spacingUnit = parseLength("0.25em");
    expect(spacingUnit).not.toBeNull();
    expect(invertSpacingMultiplier("140px", spacingUnit!)).toBeNull();
    expect(invertSpacingMultiplier("8.75em", spacingUnit!)).toBe(35);

    const theme = createDefaultTheme();
    theme.spacingUnit = spacingUnit;
    theme.cssVariables.set("--spacing", "0.25em");
    expect(findCanonicalEquivalent("w-[140px]", { theme })).toBeNull();
  });

  it("P2: Separate ring width from ring color conflicts", () => {
    // Original found case: ring-2 + ring-blue-500 must not conflict
    expect(utilitiesConflict("ring-2", "ring-blue-500")).toBe(false);
    expect(utilityIdentity("ring-2").propertyGroup).toBe("ring-width");
    expect(utilityIdentity("ring-blue-500").propertyGroup).toBe("ring-color");

    const r = transformClassString("ring-2 ring-blue-500", {
      theme: createDefaultTheme(),
    });
    expect(r.diagnostics.some((d) => d.kind === "conflict")).toBe(false);

    // Same-family ring colors still conflict
    expect(utilitiesConflict("ring-red-500", "ring-blue-500")).toBe(true);
  });
});
