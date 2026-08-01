import { describe, expect, it } from "vitest";
import { findDuplicateValueTokens } from "./css-scan.js";
import {
  generateDualThemeFromManifest,
  generateThemeCss,
  tokensFromManifest,
} from "./generate-theme.js";
import type { ThemeToken, TokenManifest } from "./types.js";

describe("theme generation", () => {
  it("prefers existing app variable aliases", () => {
    const css = generateThemeCss({
      outPath: "x.css",
      preferAppAliases: true,
      existing: [
        {
          name: "--warning-subtle",
          namespace: "color",
          values: { default: "#fde68a" },
          aliases: [],
          sources: [],
          generated: false,
        },
      ],
      tokens: [{ name: "warning-subtle", value: "#fde68a" }],
    });
    expect(css).toContain("--color-warning-subtle: var(--warning-subtle)");
    expect(css).not.toContain("--warning-background");
  });

  it("generates dual-theme :root / .dark / @theme inline", () => {
    const manifest: TokenManifest = {
      version: 1,
      mappings: [
        {
          source: "bg-white",
          target: "bg-background",
          token: "--color-background",
        },
      ],
      pairs: [
        {
          light: "bg-white",
          dark: "bg-slate-950",
          target: "bg-background",
          token: "--color-background",
          proven: true,
        },
      ],
      generateTheme: {
        dualTheme: true,
        preferAppAliases: true,
        values: {
          background: { light: "#ffffff", dark: "#020617" },
        },
      },
    };
    const css = generateDualThemeFromManifest(manifest);
    expect(css).toContain(":root {");
    expect(css).toContain("--app-background: #ffffff");
    expect(css).toContain(".dark {");
    expect(css).toContain("--app-background: #020617");
    expect(css).toContain("@theme inline");
    expect(css).toContain("--color-background: var(--app-background)");
  });

  it("does not auto-merge background and card with same value", () => {
    const tokens: ThemeToken[] = [
      {
        name: "--color-background",
        namespace: "color",
        values: { light: "#ffffff" },
        aliases: [],
        sources: [],
        generated: false,
      },
      {
        name: "--color-card",
        namespace: "color",
        values: { light: "#ffffff" },
        aliases: [],
        sources: [],
        generated: false,
      },
    ];
    const dups = findDuplicateValueTokens(tokens);
    expect(dups[0]?.tokens.length).toBe(2);
    expect(dups[0]?.note).toMatch(/Do not auto-merge/);
  });

  it("tokensFromManifest is stable", () => {
    const a = tokensFromManifest({
      version: 1,
      mappings: [
        { source: "a", target: "b", token: "--color-x" },
        { source: "c", target: "d", token: "--color-x" },
      ],
    });
    expect(a).toHaveLength(1);
  });
});
