import { describe, expect, it } from "vitest";
import { createDefaultTheme } from "./default-theme.js";
import { transformClassString } from "./pipeline.js";

const theme = createDefaultTheme();

describe("pipeline categories", () => {
  it("canonicalizes max-w-[160px] → max-w-40", () => {
    const r = transformClassString("max-w-[160px]", { theme });
    expect(r.result).toBe("max-w-40");
    expect(r.transformations[0]?.category).toBe("canonical-class");
  });

  it("preserves variants on max-w-[160px]", () => {
    expect(transformClassString("hover:max-w-[160px]", { theme }).result).toBe(
      "hover:max-w-40",
    );
    expect(transformClassString("md:max-w-[160px]", { theme }).result).toBe(
      "md:max-w-40",
    );
    expect(transformClassString("dark:md:max-w-[160px]", { theme }).result).toBe(
      "dark:md:max-w-40",
    );
    expect(transformClassString("max-w-[160px]!", { theme }).result).toBe(
      "max-w-40!",
    );
  });

  it("applies approved semantic mappings", () => {
    const r = transformClassString("bg-white text-slate-800", {
      theme,
      tokenMappings: [
        { source: "bg-white", target: "bg-background", token: "--color-background" },
        {
          source: "text-slate-800",
          target: "text-foreground",
          token: "--color-foreground",
        },
      ],
    });
    expect(r.result).toBe("bg-background text-foreground");
    expect(r.transformations.every((t) => t.category === "semantic-color-token")).toBe(
      true,
    );
  });

  it("does not apply semantic mappings unless provided (opt-in)", () => {
    const r = transformClassString("text-slate-800 bg-amber-200", { theme });
    expect(r.result).toBe("text-slate-800 bg-amber-200");
  });

  it("aggressive mode applies high-confidence inferred mappings only", () => {
    const r = transformClassString("text-slate-800 bg-white", {
      theme,
      mode: "aggressive",
      inferredMappings: [
        {
          source: "text-slate-800",
          target: "text-foreground",
          token: "--color-foreground",
          confidence: 0.9,
        },
        {
          source: "bg-white",
          target: "bg-background",
          token: "--color-background",
          confidence: 0.5,
        },
      ],
    });
    expect(r.result).toContain("text-foreground");
    expect(r.result).toContain("bg-white");
  });

  it("collapses equivalent duplicates max-w-40 max-w-[160px]", () => {
    const r = transformClassString("max-w-40 max-w-[160px]", { theme });
    expect(r.result.trim()).toBe("max-w-40");
    expect(
      r.transformations.some((t) => t.category === "duplicate-token-removal"),
    ).toBe(true);
  });

  it("reports conflict for max-w-40 max-w-44 without rewriting", () => {
    const r = transformClassString("max-w-40 max-w-44", { theme });
    expect(r.result).toContain("max-w-40");
    expect(r.result).toContain("max-w-44");
    expect(r.diagnostics.some((d) => d.kind === "conflict")).toBe(true);
  });

  it("does not collapse different variants", () => {
    const r = transformClassString("bg-white hover:bg-white", {
      theme,
      tokenMappings: [
        { source: "bg-white", target: "bg-background", token: "--color-background" },
      ],
    });
    expect(r.result).toBe("bg-background hover:bg-background");
  });

  it("runs migration + canonical together", () => {
    const r = transformClassString("bg-gradient-to-br max-w-[160px]", {
      theme,
      migrations: true,
    });
    expect(r.result).toBe("bg-linear-to-br max-w-40");
  });

  it("is idempotent for full pipeline", () => {
    const input = "hover:max-w-[160px] bg-gradient-to-br bg-white";
    const opts = {
      theme,
      migrations: true as const,
      tokenMappings: [
        { source: "bg-white", target: "bg-background", token: "--color-background" },
      ],
    };
    const first = transformClassString(input, opts);
    const second = transformClassString(first.result, opts);
    expect(second.result).toBe(first.result);
    expect(second.transformations.filter((t) => t.replacement !== "")).toHaveLength(0);
  });
});
