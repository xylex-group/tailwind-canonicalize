import { describe, expect, it } from "vitest";
import { createDefaultTheme } from "./default-theme.js";
import { findCanonicalEquivalent } from "./find-canonical.js";
import { loadThemeFromCss } from "./load-theme.js";

describe("theme loading", () => {
  it("merges @theme colors from CSS", () => {
    const theme = loadThemeFromCss(`
      @theme {
        --color-brand: #ff00aa;
        --spacing: 0.25rem;
      }
    `);
    expect(theme.colors.values.get("brand")).toBe("#ff00aa");
    expect(findCanonicalEquivalent("text-[#ff00aa]", { theme })?.canonical).toBe(
      "text-brand",
    );
  });

  it("default theme has full palette red-500", () => {
    const theme = createDefaultTheme();
    expect(theme.colors.values.get("red-500")).toBe("#ef4444");
    expect(theme.colors.values.get("slate-950")).toBe("#020617");
    expect(theme.colors.values.size).toBeGreaterThan(200);
  });
});
