import { describe, expect, it } from "vitest";
import { createDefaultTheme } from "./default-theme.js";
import { transformClassString } from "./pipeline.js";

/**
 * Explicit idempotence tests for every transformation category.
 */
describe("idempotence by category", () => {
  const theme = createDefaultTheme();

  function twice(input: string, opts: Parameters<typeof transformClassString>[1]) {
    const first = transformClassString(input, opts);
    const second = transformClassString(first.result, opts);
    expect(second.result).toBe(first.result);
    expect(
      second.transformations.filter(
        (t) => t.replacement !== "" || t.category === "duplicate-token-removal",
      ),
    ).toHaveLength(0);
    return first;
  }

  it("canonical-class", () => {
    const r = twice("max-w-[160px] hover:max-w-[160px] max-w-[160px]!", { theme });
    expect(r.result).toBe("max-w-40 hover:max-w-40 max-w-40!");
    expect(r.transformations.every((t) => t.category === "canonical-class")).toBe(true);
  });

  it("tailwind-migration", () => {
    const r = twice("hover:bg-gradient-to-br bg-gradient-to-br!", {
      migrations: true,
      arbitraryValues: false,
    });
    expect(r.result).toBe("hover:bg-linear-to-br bg-linear-to-br!");
    expect(r.transformations.every((t) => t.category === "tailwind-migration")).toBe(true);
  });

  it("semantic-color-token", () => {
    const r = twice("text-slate-800 bg-white", {
      theme,
      tokenMappings: [
        {
          source: "text-slate-800",
          target: "text-foreground",
          token: "--color-foreground",
        },
        {
          source: "bg-white",
          target: "bg-background",
          token: "--color-background",
        },
      ],
    });
    expect(r.result).toBe("text-foreground bg-background");
  });

  it("duplicate-token-removal", () => {
    const r = twice("max-w-40 max-w-[160px]", { theme });
    expect(r.result.trim()).toBe("max-w-40");
  });

  it("combined pipeline", () => {
    twice("max-w-[160px] bg-gradient-to-br bg-white text-slate-800 max-w-40", {
      theme,
      migrations: true,
      tokenMappings: [
        {
          source: "bg-white",
          target: "bg-background",
          token: "--color-background",
        },
        {
          source: "text-slate-800",
          target: "text-foreground",
          token: "--color-foreground",
        },
      ],
    });
  });

  it("safe mode does not apply semantic without mappings", () => {
    const r = transformClassString("text-slate-800", { theme, mode: "safe" });
    expect(r.result).toBe("text-slate-800");
  });
});
