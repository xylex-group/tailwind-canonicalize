import { describe, expect, it } from "vitest";
import { createDefaultTheme } from "./default-theme.js";
import { canonicalizeClass, findCanonicalEquivalent } from "./find-canonical.js";
import { loadThemeFromCss } from "./load-theme.js";
import { canonicalizeClassString } from "./pipeline.js";

describe("findCanonicalEquivalent", () => {
  const theme = createDefaultTheme();

  it("rewrites spacing arbitrary values to scale keys", () => {
    expect(findCanonicalEquivalent("w-[40px]", { theme })?.canonical).toBe("w-10");
    expect(findCanonicalEquivalent("h-[10px]", { theme })?.canonical).toBe("h-2.5");
    expect(findCanonicalEquivalent("p-[16px]", { theme })?.canonical).toBe("p-4");
    expect(findCanonicalEquivalent("gap-[8px]", { theme })?.canonical).toBe("gap-2");
    expect(findCanonicalEquivalent("min-w-[10rem]", { theme })?.canonical).toBe("min-w-40");
  });

  it("preserves variants and important", () => {
    expect(findCanonicalEquivalent("hover:md:w-[40px]", { theme })?.canonical).toBe(
      "hover:md:w-10",
    );
    expect(findCanonicalEquivalent("w-[40px]!", { theme })?.canonical).toBe("w-10!");
    expect(findCanonicalEquivalent("!w-[40px]", { theme })?.canonical).toBe("w-10!");
  });

  it("handles negatives", () => {
    expect(findCanonicalEquivalent("-top-[20px]", { theme })?.canonical).toBe("-top-5");
    expect(findCanonicalEquivalent("top-[-20px]", { theme })?.canonical).toBe("-top-5");
  });

  it("rewrites keywords", () => {
    expect(findCanonicalEquivalent("w-[100%]", { theme })?.canonical).toBe("w-full");
    expect(findCanonicalEquivalent("h-[100vh]", { theme })?.canonical).toBe("h-screen");
    expect(findCanonicalEquivalent("w-[auto]", { theme })?.canonical).toBe("w-auto");
    expect(findCanonicalEquivalent("w-[fit-content]", { theme })?.canonical).toBe("w-fit");
    expect(findCanonicalEquivalent("w-[max-content]", { theme })?.canonical).toBe("w-max");
    expect(findCanonicalEquivalent("w-[min-content]", { theme })?.canonical).toBe("w-min");
  });

  it("rewrites fractions", () => {
    expect(findCanonicalEquivalent("w-[50%]", { theme })?.canonical).toBe("w-1/2");
    expect(findCanonicalEquivalent("w-[25%]", { theme })?.canonical).toBe("w-1/4");
  });

  it("rewrites radius", () => {
    expect(findCanonicalEquivalent("rounded-[8px]", { theme })?.canonical).toBe("rounded-lg");
    expect(findCanonicalEquivalent("rounded-[16px]", { theme })?.canonical).toBe("rounded-2xl");
  });

  it("rewrites text size", () => {
    expect(findCanonicalEquivalent("text-[16px]", { theme })?.canonical).toBe("text-base");
    expect(findCanonicalEquivalent("text-[24px]", { theme })?.canonical).toBe("text-2xl");
  });

  it("never touches arbitrary properties", () => {
    expect(findCanonicalEquivalent("[mask-image:url(/x)]", { theme })).toBeNull();
    expect(findCanonicalEquivalent("[animation:spin_1s_linear]", { theme })).toBeNull();
  });

  it("never touches calc or var", () => {
    expect(findCanonicalEquivalent("w-[calc(100%-1rem)]", { theme })).toBeNull();
    expect(findCanonicalEquivalent("w-[var(--sidebar)]", { theme })).toBeNull();
  });

  it("never rewrites unknown values", () => {
    expect(findCanonicalEquivalent("w-[13px]", { theme })).toBeNull();
    expect(findCanonicalEquivalent("w-[39px]", { theme })).toBeNull();
  });

  it("matches colors only when exact", () => {
    expect(findCanonicalEquivalent("text-[#ef4444]", { theme })?.canonical).toBe("text-red-500");
    expect(findCanonicalEquivalent("text-[#ff0000]", { theme })).toBeNull();
  });

  it("uses project @theme overrides", () => {
    const custom = loadThemeFromCss(`
      @theme {
        --spacing: 0.25rem;
        --color-brand: #ff0000;
      }
    `);
    expect(findCanonicalEquivalent("text-[#ff0000]", { theme: custom })?.canonical).toBe(
      "text-brand",
    );
  });

  it("canonicalizeClass leaves non-matches intact", () => {
    expect(canonicalizeClass("flex", { theme })).toBe("flex");
    expect(canonicalizeClass("w-10", { theme })).toBe("w-10");
  });

  it("canonicalizeClassString preserves whitespace layout", () => {
    const input = `
    w-[40px]
    min-w-[10rem]
    h-[10px]
    p-[16px]
    gap-[8px]
`;
    const { result, rewrites } = canonicalizeClassString(input, { theme });
    expect(rewrites.length).toBe(5);
    expect(result).toContain("w-10");
    expect(result).toContain("min-w-40");
    expect(result).toContain("h-2.5");
    expect(result).toContain("p-4");
    expect(result).toContain("gap-2");
    expect(result.startsWith("\n")).toBe(true);
  });
});

describe("negative arbitrary parsing", () => {
  it("normalizes top-[-20px] via value sign", () => {
    const theme = createDefaultTheme();
    // top-[-20px] has positive namespace with negative length inside
    const match = findCanonicalEquivalent("top-[-20px]", { theme });
    expect(match?.canonical).toBe("-top-5");
  });
});
