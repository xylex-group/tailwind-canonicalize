import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildStyleUsageReport,
  formatStyleUsageReportMarkdown,
  semanticBareFromBase,
  toReportPath,
} from "./style-report.js";

describe("toReportPath", () => {
  it("emits POSIX separators even when relative paths use backslashes", () => {
    const cwd = "C:\\Users\\proj";
    const file = "C:\\Users\\proj\\src\\components\\Card.tsx";
    // path.relative may produce \ on Windows; helper must normalize
    const out = toReportPath(file, cwd, true);
    expect(out).not.toContain("\\");
    expect(out.includes("/") || out.includes("Card")).toBe(true);
  });

  it("normalizes absolute fallbacks", () => {
    const out = toReportPath("C:\\abs\\src\\a.tsx", "D:\\other", false);
    expect(out).not.toContain("\\");
    expect(out).toContain("/");
  });
});

describe("semanticBareFromBase", () => {
  it("strips channel prefixes for semantic bases", () => {
    expect(semanticBareFromBase("bg-background")).toBe("background");
    expect(semanticBareFromBase("text-muted-foreground")).toBe(
      "muted-foreground",
    );
    expect(semanticBareFromBase("border-border")).toBe("border");
  });

  it("returns null for palette bases", () => {
    expect(semanticBareFromBase("bg-blue-500")).toBeNull();
    expect(semanticBareFromBase("text-black")).toBeNull();
  });
});

describe("buildStyleUsageReport", () => {
  it("counts color utilities by tag for drift analysis", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "tc-style-"));
    const file = path.join(dir, "Card.tsx");
    await writeFile(
      file,
      `
export function Card() {
  return (
    <div className="bg-slate-200 text-black border-gray-200">
      <button className="bg-blue-500 text-white hover:bg-blue-600">
        Save
      </button>
      <button className="bg-red-500 text-white">
        Delete
      </button>
      <p className="text-muted-foreground text-sm">Hint</p>
    </div>
  );
}
`,
      "utf8",
    );

    const report = await buildStyleUsageReport({
      cwd: dir,
      files: [file],
      skipThemeScan: true,
    });

    expect(report.version).toBe(2);
    expect(report.filesAnalyzed).toBe(1);
    expect(report.summary.totalHits).toBeGreaterThan(5);

    const textBlack = report.utilities.find((u) => u.base === "text-black");
    expect(textBlack?.count).toBeGreaterThanOrEqual(1);
    expect(textBlack?.tags.div ?? textBlack?.tags["div"]).toBeTruthy();

    const bgBlue = report.utilities.find((u) => u.base === "bg-blue-500");
    expect(bgBlue?.kind).toBe("palette");
    expect(bgBlue?.tags.button).toBeGreaterThanOrEqual(1);

    expect(report.utilities.some((u) => u.base === "text-sm")).toBe(false);

    const muted = report.utilities.find(
      (u) => u.base === "text-muted-foreground",
    );
    expect(muted?.kind).toBe("semantic");

    const buttonTag = report.byTag.find((t) => t.tag === "button");
    expect(buttonTag).toBeTruthy();
    expect(buttonTag!.count).toBeGreaterThanOrEqual(4);

    expect(
      report.drift.some(
        (d) =>
          d.tag === "button" ||
          d.kind === "mixed-palette-on-tag" ||
          d.kind === "multi-color-same-tag",
      ),
    ).toBe(true);

    const md = formatStyleUsageReportMarkdown(report);
    expect(md).toContain("Style usage report");
    expect(md).toContain("Top utilities");
    expect(md).toContain("Top files");
    expect(md).toContain("Health");
  });

  it("uses POSIX path keys under nested directories (no backslash)", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "tc-style-path-"));
    const nested = path.join(dir, "src", "components", "settings");
    await mkdir(nested, { recursive: true });
    const file = path.join(nested, "cloudflare-surface-overview.tsx");
    await writeFile(
      file,
      `export function Overview() {
  return <div className="bg-blue-500 text-white">x</div>;
}
`,
      "utf8",
    );

    const report = await buildStyleUsageReport({
      cwd: dir,
      files: [file],
      skipThemeScan: true,
    });

    const expectedRel = "src/components/settings/cloudflare-surface-overview.tsx";
    expect(report.summary.topFiles[0]?.file).toBe(expectedRel);
    expect(report.byFile[0]?.file).toBe(expectedRel);

    const bg = report.utilities.find((u) => u.base === "bg-blue-500");
    expect(bg).toBeTruthy();
    expect(Object.keys(bg!.files)).toEqual([expectedRel]);
    expect(bg!.samples[0]?.file).toBe(expectedRel);

    // Never emit Windows separators in JSON-facing keys
    const json = JSON.stringify(report);
    expect(json).not.toMatch(/src\\\\components/);
    expect(json).toContain(expectedRel);
  });

  it("builds byFile topFiles and variant/palette rollups", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "tc-style-idx-"));
    const a = path.join(dir, "a.tsx");
    const b = path.join(dir, "b.tsx");
    await writeFile(
      a,
      `export const A = () => <button className="bg-blue-500 hover:bg-blue-600 text-white">A</button>;`,
      "utf8",
    );
    await writeFile(
      b,
      `export const B = () => <p className="text-slate-500 dark:text-slate-200">B</p>;`,
      "utf8",
    );

    const report = await buildStyleUsageReport({
      cwd: dir,
      files: [a, b],
      skipThemeScan: true,
    });

    expect(report.byFile.length).toBe(2);
    expect(report.summary.topFiles.length).toBe(2);
    const aFile = report.byFile.find((f) => f.file === "a.tsx");
    expect(aFile?.count).toBeGreaterThanOrEqual(3);
    expect(aFile?.uniqueUtilities).toBeGreaterThanOrEqual(2);

    expect(report.summary.byPalette.blue).toBeGreaterThanOrEqual(2);
    expect(report.summary.byVariant.hover).toBeGreaterThanOrEqual(1);
    expect(report.summary.byVariant.dark).toBeGreaterThanOrEqual(1);
    expect(report.summary.byVariant.base).toBeGreaterThanOrEqual(1);
    expect(report.summary.health.score).toBeGreaterThanOrEqual(0);
    expect(report.summary.health.score).toBeLessThanOrEqual(100);
  });

  it("scores semantic-heavy projects healthier than palette-heavy", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "tc-style-health-"));
    const semantic = path.join(dir, "semantic.tsx");
    const palette = path.join(dir, "palette.tsx");
    await writeFile(
      semantic,
      `export const S = () => (
  <div className="bg-background text-foreground border-border">
    <p className="text-muted-foreground">ok</p>
  </div>
);`,
      "utf8",
    );
    await writeFile(
      palette,
      `export const P = () => (
  <div className="bg-slate-100 text-slate-900 border-slate-200">
    <p className="text-blue-500 bg-red-500 border-amber-300 text-green-600">x</p>
  </div>
);`,
      "utf8",
    );

    const semReport = await buildStyleUsageReport({
      cwd: dir,
      files: [semantic],
      skipThemeScan: true,
    });
    const palReport = await buildStyleUsageReport({
      cwd: dir,
      files: [palette],
      skipThemeScan: true,
    });

    expect(semReport.summary.health.semanticRatio).toBeGreaterThan(
      palReport.summary.health.semanticRatio,
    );
    expect(semReport.summary.health.score).toBeGreaterThanOrEqual(
      palReport.summary.health.score,
    );
  });

  it("analyzes theme CSS and emits missing-token suggestions", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "tc-style-theme-"));
    await writeFile(
      path.join(dir, "globals.css"),
      `
:root {
  --color-background: #ffffff;
  --color-orphan: #ff00ff;
}
@theme {
  --color-background: var(--color-background);
  --color-orphan: var(--color-orphan);
}
`,
      "utf8",
    );
    await writeFile(
      path.join(dir, "App.tsx"),
      `export const App = () => (
  <div className="bg-background text-muted-foreground">
    <span className="text-primary">hi</span>
  </div>
);`,
      "utf8",
    );

    const report = await buildStyleUsageReport({
      cwd: dir,
      files: [path.join(dir, "App.tsx")],
      // allow theme scan of this temp tree
    });

    expect(report.theme.filesScanned.some((f) => f.endsWith("globals.css"))).toBe(
      true,
    );
    const bgToken = report.theme.colorTokens.find(
      (t) => t.bare === "background" || t.name === "--color-background",
    );
    expect(bgToken?.usageCount).toBeGreaterThanOrEqual(1);
    expect(bgToken?.usedAs.some((u) => u.includes("background"))).toBe(true);

    expect(
      report.theme.unusedColorTokens.some((n) => n.includes("orphan")),
    ).toBe(true);

    expect(
      report.theme.missingForSemanticUtilities.some(
        (m) =>
          m.utility.includes("muted-foreground") ||
          m.suggestedCssVar.includes("muted-foreground") ||
          m.utility.includes("primary"),
      ),
    ).toBe(true);

    expect(
      report.suggestions.some((s) => s.kind === "add-css-color-token"),
    ).toBe(true);
    expect(
      report.drift.some(
        (d) =>
          d.kind === "missing-theme-token" || d.kind === "unused-theme-token",
      ),
    ).toBe(true);

    const md = formatStyleUsageReportMarkdown(report);
    expect(md).toContain("Theme CSS");
    expect(md).toContain("Workflow suggestions");
  });
});
