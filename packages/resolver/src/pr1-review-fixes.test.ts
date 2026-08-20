import { describe, expect, it } from "vitest";
import { createDefaultTheme } from "./default-theme.js";
import { findCanonicalEquivalent } from "./find-canonical.js";
import { transformClassString } from "./pipeline.js";
import type { Theme } from "./types.js";
import { utilitiesConflict, utilityIdentity } from "./utility-identity.js";

function v3ThemeLike(): Theme {
  const theme = createDefaultTheme();
  // v3 load path sets spacingUnit from scale key "1" and marks version 3
  theme.tailwindVersion = 3;
  return theme;
}

describe("PR #1 review fixes", () => {
  it("P1: Restrict continuous spacing rewrites to Tailwind v4", () => {
    // Original found case: default-v3 w-[140px] must NOT become w-35
    const v3 = v3ThemeLike();
    expect(findCanonicalEquivalent("w-[140px]", { theme: v3 })).toBeNull();

    // v4 still rewrites continuous keys
    const v4 = createDefaultTheme();
    expect(findCanonicalEquivalent("w-[140px]", { theme: v4 })?.canonical).toBe("w-35");
  });

  it("P1: Avoid overriding explicit spacing keys", () => {
    // Original found case: --spacing 0.25rem + --spacing-35: 10rem
    // w-[140px] must not emit w-35 (which resolves to 10rem, not 140px)
    const theme = createDefaultTheme();
    theme.spacing.values.set("35", "10rem");
    expect(findCanonicalEquivalent("w-[140px]", { theme })).toBeNull();

    // When explicit key matches the inverted length, allow rewrite
    theme.spacing.values.set("35", "8.75rem"); // 140px at 16px root
    expect(findCanonicalEquivalent("w-[140px]", { theme })?.canonical).toBe("w-35");
  });

  it("P1: Exclude border widths from spacing inversion", () => {
    // Original found case: border-[13px] must NOT become border-3.25
    const theme = createDefaultTheme();
    expect(findCanonicalEquivalent("border-[13px]", { theme })).toBeNull();
    expect(findCanonicalEquivalent("border-t-[13px]", { theme })).toBeNull();

    // Spacing-based namespaces still invert
    expect(findCanonicalEquivalent("w-[13px]", { theme })?.canonical).toBe("w-3.25");
    // border-spacing uses --spacing multipliers
    expect(findCanonicalEquivalent("border-spacing-[13px]", { theme })?.canonical).toBe(
      "border-spacing-3.25",
    );
  });

  it("P1: Border width uses px scale not spacing (border-b-[8px] → border-b-8)", () => {
    // Original found case: border-b-[8px] must NOT become border-b-2 (spacing).
    // Tailwind border-2 = 2px; border-8 = 8px.
    const theme = createDefaultTheme();
    expect(findCanonicalEquivalent("border-b-[8px]", { theme })?.canonical).toBe("border-b-8");
    expect(findCanonicalEquivalent("border-[8px]", { theme })?.canonical).toBe("border-8");
    expect(findCanonicalEquivalent("border-b-[2px]", { theme })?.canonical).toBe("border-b-2");
    expect(findCanonicalEquivalent("border-x-[4px]", { theme })?.canonical).toBe("border-x-4");
    // Non-scale widths stay arbitrary
    expect(findCanonicalEquivalent("md:border-b-[10px]", { theme })).toBeNull();
    expect(findCanonicalEquivalent("md:border-l-[6px]", { theme })).toBeNull();
    // Never map 8px → spacing key 2
    expect(findCanonicalEquivalent("border-b-[8px]", { theme })?.canonical).not.toBe("border-b-2");
  });

  it("P2: Distinguish text property families before reporting conflicts", () => {
    // Original found case: text-center + text-red-500 must not conflict
    expect(utilitiesConflict("text-center", "text-red-500")).toBe(false);
    expect(utilityIdentity("text-center").propertyGroup).toBe("text-align");
    expect(utilityIdentity("text-red-500").propertyGroup).toBe("text-color");

    const r = transformClassString("text-center text-red-500", {
      theme: createDefaultTheme(),
    });
    expect(r.diagnostics.some((d) => d.kind === "conflict")).toBe(false);

    // Same-family colors still conflict (existing safety)
    expect(utilitiesConflict("text-foreground", "text-muted-foreground")).toBe(true);
    const r2 = transformClassString("text-foreground text-muted-foreground", {
      theme: createDefaultTheme(),
    });
    expect(r2.diagnostics.some((d) => d.kind === "conflict")).toBe(true);
  });
});
