import { describe, expect, it } from "vitest";
import { transformClassString } from "./pipeline.js";
import { BUILTIN_RECIPES, resolveRecipeOverrides } from "./recipes.js";

describe("semantic recipes", () => {
  it("detects warning-surface co-occurrence", () => {
    const { overrides } = resolveRecipeOverrides(
      ["border-amber-200", "bg-amber-200", "text-slate-800"],
      BUILTIN_RECIPES,
    );
    expect(overrides.get("bg-amber-200")).toBe("bg-warning-subtle");
    expect(overrides.get("border-amber-200")).toBe("border-warning-subtle");
    expect(overrides.get("text-slate-800")).toBe("text-warning-foreground");
  });

  it("applies coherent recipe instead of independent foreground mapping", () => {
    const r = transformClassString(
      "border-amber-200 bg-amber-200 text-slate-800",
      {
        recipes: BUILTIN_RECIPES,
        tokenMappings: [
          {
            source: "bg-amber-200",
            target: "bg-warning-subtle",
            token: "--color-warning-subtle",
          },
          {
            source: "border-amber-200",
            target: "border-warning-subtle",
            token: "--color-warning-subtle",
          },
          {
            // Without recipe, this would become text-foreground
            source: "text-slate-800",
            target: "text-foreground",
            token: "--color-foreground",
          },
        ],
      },
    );
    expect(r.result).toBe(
      "border-warning-subtle bg-warning-subtle text-warning-foreground",
    );
  });

  it("is idempotent", () => {
    const opts = {
      recipes: BUILTIN_RECIPES,
      tokenMappings: [
        {
          source: "bg-amber-200",
          target: "bg-warning-subtle",
          token: "--color-warning-subtle",
        },
        {
          source: "border-amber-200",
          target: "border-warning-subtle",
          token: "--color-warning-subtle",
        },
        {
          source: "text-slate-800",
          target: "text-warning-foreground",
          token: "--color-warning-foreground",
        },
      ],
    };
    const input = "border-amber-200 bg-amber-200 text-slate-800";
    const first = transformClassString(input, opts);
    const second = transformClassString(first.result, opts);
    expect(second.result).toBe(first.result);
  });
});
