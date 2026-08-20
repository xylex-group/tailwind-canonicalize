import { describe, expect, it } from "vitest";
import { collapseDarkPairs } from "./dark-pairs.js";
import { transformClassString } from "./pipeline.js";

describe("dark-pair collapse", () => {
  const pair = {
    light: "bg-white",
    dark: "bg-slate-950",
    target: "bg-background",
    token: "--color-background",
    proven: true,
  };

  it("collapses bg-white dark:bg-slate-950 → bg-background", () => {
    const { tokens, transformations } = collapseDarkPairs(["bg-white", "dark:bg-slate-950"], {
      pairs: [pair],
    });
    expect(tokens).toEqual(["bg-background"]);
    expect(transformations[0]?.category).toBe("semantic-color-token");
    expect(transformations[0]?.token).toBe("--color-background");
  });

  it("does not collapse when dark pair is unproven", () => {
    const { tokens } = collapseDarkPairs(["bg-white", "dark:bg-slate-950"], {
      pairs: [{ ...pair, proven: false }],
      requireProven: true,
    });
    expect(tokens).toEqual(["bg-white", "dark:bg-slate-950"]);
  });

  it("does not collapse different important flags", () => {
    const { tokens } = collapseDarkPairs(["bg-white!", "dark:bg-slate-950"], {
      pairs: [pair],
    });
    expect(tokens).toEqual(["bg-white!", "dark:bg-slate-950"]);
  });

  it("does not collapse hover:bg-white with dark:bg-slate-950", () => {
    const { tokens } = collapseDarkPairs(["hover:bg-white", "dark:bg-slate-950"], {
      pairs: [pair],
    });
    expect(tokens).toEqual(["hover:bg-white", "dark:bg-slate-950"]);
  });

  it("pipeline integrates pairs with mappings", () => {
    const r = transformClassString("bg-white dark:bg-slate-950 text-slate-800", {
      tokenMappings: [
        {
          source: "text-slate-800",
          target: "text-foreground",
          token: "--color-foreground",
        },
      ],
      themePairs: [pair],
    });
    expect(r.result).toBe("bg-background text-foreground");
  });

  it("is idempotent", () => {
    const opts = {
      themePairs: [pair],
      tokenMappings: [] as { source: string; target: string }[],
    };
    const first = transformClassString("bg-white dark:bg-slate-950", opts);
    const second = transformClassString(first.result, opts);
    expect(second.result).toBe(first.result);
    expect(second.transformations.filter((t) => t.replacement !== "")).toHaveLength(0);
  });
});
