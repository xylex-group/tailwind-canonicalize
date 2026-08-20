import { describe, expect, it } from "vitest";
import { colorsEqual, normalizeColor } from "./color-normalize.js";
import { buildTargetUtility, extractStructuralHints, proposeSemanticToken } from "./context.js";
import { findAliasCycles, findDuplicateValueTokens } from "./css-scan.js";
import { generateThemeCss } from "./generate-theme.js";
import { parseColorUtility } from "./palette.js";
import type { ThemeToken, TokenAlias } from "./types.js";

describe("color normalize", () => {
  it("equates hex forms", () => {
    expect(colorsEqual("#fff", "#ffffff")).toBe(true);
    expect(colorsEqual("#ffffff", "rgb(255, 255, 255)")).toBe(true);
    expect(colorsEqual("rgb(255 255 255)", "#ffffff")).toBe(true);
    expect(normalizeColor("white")).toBe("#ffffff");
  });

  it("does not equate close colors", () => {
    expect(colorsEqual("#ffffff", "#fffffe")).toBe(false);
  });
});

describe("parseColorUtility", () => {
  it("parses palette utilities", () => {
    expect(parseColorUtility("text-slate-800")).toMatchObject({
      property: "text",
      palette: "slate",
      shade: "800",
    });
    expect(parseColorUtility("bg-amber-200")).toMatchObject({
      property: "bg",
      palette: "amber",
      shade: "200",
    });
    expect(parseColorUtility("bg-white")).toMatchObject({
      palette: "white",
    });
  });
});

describe("proposeSemanticToken", () => {
  it("proposes warning-subtle for amber bg in warning context", () => {
    const p = proposeSemanticToken("bg", "amber", "200", "warning");
    expect(p?.token).toBe("warning-subtle");
    expect(buildTargetUtility("bg", p!.token)).toBe("bg-warning-subtle");
  });

  it("proposes foreground for slate-800 text", () => {
    const p = proposeSemanticToken("text", "slate", "800", null);
    expect(p?.token).toBe("foreground");
  });

  it("proposes muted-foreground for slate-600", () => {
    const p = proposeSemanticToken("text", "slate", "600", null);
    expect(p?.token).toBe("muted-foreground");
  });

  it("proposes background for white", () => {
    const p = proposeSemanticToken("bg", "white", null, null);
    expect(p?.token).toBe("background");
  });
});

describe("structural hints", () => {
  it("extracts aria role and cva variant", () => {
    const h = extractStructuralHints(
      `<div role="alert" className={cva({ variant: "warning" })("bg-amber-200")}>`,
    );
    expect(h.ariaRole).toBe("alert");
    expect(h.cvaVariant).toBe("warning");
  });
});

describe("token graph", () => {
  it("detects alias cycles", () => {
    const aliases: TokenAlias[] = [
      { from: "--color-background", to: "--surface", reason: "existing-alias" },
      { from: "--surface", to: "--page", reason: "existing-alias" },
      { from: "--page", to: "--color-background", reason: "existing-alias" },
    ];
    const cycles = findAliasCycles(aliases);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it("reports duplicate values without merging semantic roles", () => {
    const tokens: ThemeToken[] = [
      {
        name: "--color-background",
        namespace: "color",
        values: { light: "#ffffff", default: "#ffffff" },
        aliases: [],
        sources: [],
        generated: false,
      },
      {
        name: "--color-card",
        namespace: "color",
        values: { light: "#ffffff", default: "#ffffff" },
        aliases: [],
        sources: [],
        generated: false,
      },
    ];
    const dups = findDuplicateValueTokens(tokens);
    expect(dups[0]?.tokens).toEqual(expect.arrayContaining(["--color-background", "--color-card"]));
    expect(dups[0]?.note).toMatch(/Do not auto-merge/);
  });

  it("generates @theme CSS preferring app aliases", () => {
    const css = generateThemeCss({
      outPath: "x.css",
      preferAppAliases: true,
      existing: [
        {
          name: "--app-background",
          namespace: "color",
          values: { default: "#fff" },
          aliases: [],
          sources: [],
          generated: false,
        },
      ],
      tokens: [{ name: "background", value: "#ffffff" }],
    });
    expect(css).toContain("--color-background: var(--app-background)");
  });
});
