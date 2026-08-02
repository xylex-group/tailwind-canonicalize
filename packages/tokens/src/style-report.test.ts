import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildStyleUsageReport,
  formatStyleUsageReportMarkdown,
} from "./style-report.js";

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
    });

    expect(report.filesAnalyzed).toBe(1);
    expect(report.summary.totalHits).toBeGreaterThan(5);

    const textBlack = report.utilities.find((u) => u.base === "text-black");
    expect(textBlack?.count).toBeGreaterThanOrEqual(1);
    expect(textBlack?.tags.div ?? textBlack?.tags["div"]).toBeTruthy();

    const bgBlue = report.utilities.find((u) => u.base === "bg-blue-500");
    expect(bgBlue?.kind).toBe("palette");
    expect(bgBlue?.tags.button).toBeGreaterThanOrEqual(1);

    // text-sm is font-size, not a color — must not appear as color utility
    expect(report.utilities.some((u) => u.base === "text-sm")).toBe(false);

    // semantic color
    const muted = report.utilities.find(
      (u) => u.base === "text-muted-foreground",
    );
    expect(muted?.kind).toBe("semantic");

    const buttonTag = report.byTag.find((t) => t.tag === "button");
    expect(buttonTag).toBeTruthy();
    expect(buttonTag!.count).toBeGreaterThanOrEqual(4);

    // Mixed palettes on button → drift
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
  });
});
