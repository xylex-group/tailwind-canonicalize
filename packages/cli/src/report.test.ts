import type { ClassStringDiagnostic } from "@tailwind-canonicalize/resolver";
import { describe, expect, it } from "vitest";
import { formatHelp, HELP } from "./args.js";
import { formatDiagnosticSummary, formatNum, formatTransformationBlock } from "./report.js";

describe("formatDiagnosticSummary", () => {
  it("groups repeated conflict diagnostics", () => {
    const diags: ClassStringDiagnostic[] = [
      {
        kind: "conflict",
        message:
          "Conflicting border-color-or-width utilities: border and border-border. The latter currently wins through source order. No automatic resolution applied.",
        utilities: ["border", "border-border"],
      },
      {
        kind: "conflict",
        message:
          "Conflicting border-color-or-width utilities: border and border-border. The latter currently wins through source order. No automatic resolution applied.",
        utilities: ["border", "border-border"],
      },
      {
        kind: "conflict",
        message:
          "Conflicting flex utilities: flex and flex-col. The latter currently wins through source order. No automatic resolution applied.",
        utilities: ["flex", "flex-col"],
      },
      {
        kind: "conflict",
        message:
          "Conflicting color-or-font-size utilities: text-sm and text-muted-foreground. The latter currently wins through source order. No automatic resolution applied.",
        utilities: ["text-sm", "text-muted-foreground"],
      },
    ];

    const out = formatDiagnosticSummary(diags, undefined, 12);
    expect(out).toContain("4");
    expect(out).toContain("border-color-or-width");
    expect(out).toContain("flex");
    expect(out).toContain("color-or-font-size");
    expect(out).toContain("border ↔ border-border");
    expect(out).not.toMatch(/No automatic resolution applied\./);
  });

  it("collapses identical parse-error spam", () => {
    const diags: ClassStringDiagnostic[] = Array.from({ length: 50 }, () => ({
      kind: "info" as const,
      message: "parse error: Cannot assign to this expression",
      utilities: [] as string[],
    }));
    const out = formatDiagnosticSummary(diags, undefined, 12);
    expect(out).toContain("50");
    expect(out).toContain("parse");
    expect(out).toContain("Cannot assign to this expression");
    // Must not print 50 separate lines
    expect(out.split("\n").length).toBeLessThan(15);
  });
});

describe("formatTransformationBlock", () => {
  it("renders minus/plus style rewrite", () => {
    const block = formatTransformationBlock(
      "components/Card.tsx",
      {
        category: "canonical-class",
        original: "w-[40px] p-[16px]",
        replacement: "w-10 p-4",
        line: 12,
        confidence: "exact",
        safety: "safe",
      },
      // force no color for stable assert
      {
        bold: (s) => s,
        dim: (s) => s,
        red: (s) => s,
        green: (s) => s,
        cyan: (s) => s,
        yellow: (s) => s,
        blue: (s) => s,
        magenta: (s) => s,
        gray: (s) => s,
        white: (s) => s,
        reset: (s) => s,
      },
    );

    expect(block).toContain("components/Card.tsx:12");
    expect(block).toContain("− w-[40px] p-[16px]");
    expect(block).toContain("+ w-10 p-4");
    expect(block).toContain("category: canonical-class");
    expect(block).toContain("safety: exact");
  });
});

describe("formatNum", () => {
  it("formats thousands", () => {
    expect(formatNum(9421)).toBe("9,421");
  });
});

const ESC = String.fromCharCode(27);
const ANSI_CSI = `${ESC}[`;
const ANSI_SGR = new RegExp(`${ESC}\\[[0-9;]*m`, "g");

describe("formatHelp", () => {
  it("returns plain HELP when color is disabled", () => {
    expect(formatHelp(false)).toBe(HELP);
    expect(formatHelp(false)).not.toContain(ANSI_CSI);
  });

  it("applies ANSI to title, sections, and flags when color is enabled", () => {
    const out = formatHelp(true);
    expect(out).toContain(ANSI_CSI);
    // bold/cyan title name
    expect(out).toContain(`${ESC}[1m`);
    expect(out).toContain(`${ESC}[36m`);
    // yellow section headers
    expect(out).toContain(`${ESC}[33m`);
    // flag tokens
    expect(out).toContain("--write");
    expect(out).toContain("USAGE");
    // strip codes still contains plain content
    const plain = out.replace(ANSI_SGR, "");
    expect(plain).toContain("tailwind-canonicalize");
    expect(plain).toContain("--check");
    expect(plain).toContain("EXIT CODES");
  });
});
