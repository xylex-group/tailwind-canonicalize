import { describe, expect, it } from "vitest";
import {
  looksLikeFlag,
  parseArgs,
  requireOptionValue,
} from "./args.js";

describe("looksLikeFlag", () => {
  it("detects CLI flags", () => {
    expect(looksLikeFlag("-h")).toBe(true);
    expect(looksLikeFlag("--help")).toBe(true);
    expect(looksLikeFlag("--verbose")).toBe(true);
    expect(looksLikeFlag("-")).toBe(true);
    expect(looksLikeFlag("--")).toBe(true);
  });

  it("allows path-like values", () => {
    expect(looksLikeFlag("report.txt")).toBe(false);
    expect(looksLikeFlag("./-h")).toBe(false);
    expect(looksLikeFlag(".\\-h")).toBe(false);
    expect(looksLikeFlag("/tmp/report.txt")).toBe(false);
    expect(looksLikeFlag("C:\\out\\report.txt")).toBe(false);
  });
});

describe("requireOptionValue", () => {
  it("rejects --report -h (original found case)", () => {
    expect(() =>
      requireOptionValue("--report", ["--report", "-h"], 0, "report.txt"),
    ).toThrow(/--report.*"-h".*-h\/--help/s);
  });

  it("rejects missing value at end of argv", () => {
    expect(() => requireOptionValue("--report", ["--report"], 0)).toThrow(
      /end of arguments/,
    );
  });

  it("accepts a normal path", () => {
    const r = requireOptionValue(
      "--report",
      ["--report", "out.txt", "--check"],
      0,
      "report.txt",
    );
    expect(r.value).toBe("out.txt");
    expect(r.nextIndex).toBe(1);
  });
});

describe("parseArgs --report", () => {
  it("throws when --report is followed by -h (original found case)", () => {
    expect(() =>
      parseArgs(["--check", "--verbose", "--report", "-h"]),
    ).toThrow(/Option --report requires a value \(got "-h"\)/);
  });

  it("throws when --report is followed by another flag", () => {
    expect(() => parseArgs(["--report", "--verbose"])).toThrow(
      /Option --report requires a value/,
    );
  });

  it("throws when --report has no value", () => {
    expect(() => parseArgs(["--report"])).toThrow(/end of arguments/);
  });

  it("parses --report out.txt --check", () => {
    const args = parseArgs(["--report", "out.txt", "--check"]);
    expect(args.reportPath).toBe("out.txt");
    expect(args.check).toBe(true);
    expect(args.help).toBe(false);
  });

  it("parses --report=out.txt", () => {
    const args = parseArgs(["--report=out.txt", "--check"]);
    expect(args.reportPath).toBe("out.txt");
    expect(args.check).toBe(true);
  });

  it("parses -o=out.txt", () => {
    const args = parseArgs(["-o=out.txt"]);
    expect(args.reportPath).toBe("out.txt");
  });

  it("still accepts help alone or after other flags", () => {
    expect(parseArgs(["-h"]).help).toBe(true);
    expect(parseArgs(["--check", "--verbose", "-h"]).help).toBe(true);
    expect(parseArgs(["--check", "--verbose", "--help"]).help).toBe(true);
  });

  it("allows intentional dash-leading paths via ./ prefix", () => {
    const args = parseArgs(["--report", "./-h"]);
    expect(args.reportPath).toBe("./-h");
  });
});
