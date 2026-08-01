import { describe, expect, it } from "vitest";
import { createDefaultTheme } from "@tailwind-canonicalize/resolver";
import { isSafeStaticQuasi, transformSource } from "./transform.js";

describe("isSafeStaticQuasi", () => {
  it("accepts complete static class lists", () => {
    expect(isSafeStaticQuasi(" flex flex-col p-4 ")).toBe(true);
    expect(isSafeStaticQuasi("w-10 bg-red-500")).toBe(true);
  });

  it("rejects partial stems around interpolations", () => {
    expect(isSafeStaticQuasi("text-")).toBe(false);
    expect(isSafeStaticQuasi("bg-[")).toBe(false);
    expect(isSafeStaticQuasi("px]")).toBe(false);
    expect(isSafeStaticQuasi(" text-${color}")).toBe(false);
  });
});

describe("transformSource safety", () => {
  const theme = createDefaultTheme();

  it("does not rewrite incomplete interpolated template stems", () => {
    const source =
      'export const el = <div className={`text-${color} bg-[${value}px]`} />;';
    const result = transformSource(source, {
      filePath: "file.tsx",
      theme,
    });
    // Must not produce broken templates like `text-sm-${color}` or corrupted brackets
    expect(result.code).toContain("`text-${color}");
    expect(result.code).toContain("bg-[${value}px]");
    expect(result.changed).toBe(false);
  });

  it("rewrites complete static quasis next to interpolations", () => {
    const source =
      'export const el = <div className={`foo ${bar} w-[40px] p-4`} />;';
    const result = transformSource(source, {
      filePath: "file.tsx",
      theme,
    });
    expect(result.code).toMatch(/w-10/);
    expect(result.code).toContain("${bar}");
  });

  it("skips rewrites when the parser reports errors", () => {
    // Unclosed JSX / broken source
    const source =
      'export function Broken( { return <div className="w-[40px]">';
    const result = transformSource(source, {
      filePath: "broken.tsx",
      theme,
    });
    // If oxc surfaces errors, we must not rewrite
    if ((result.parseErrors?.length ?? 0) > 0) {
      expect(result.changed).toBe(false);
      expect(result.code).toBe(source);
      expect(result.rewrites).toHaveLength(0);
    }
  });

  it("validates template spans before overwrite", () => {
    const source = 'export const el = <div className={`p-[16px]`} />;';
    const result = transformSource(source, {
      filePath: "file.tsx",
      theme,
    });
    expect(result.changed).toBe(true);
    expect(result.code).toContain("p-4");
    expect(result.code).toMatch(/`p-4`/);
    expect(result.code).not.toMatch(/``/);
  });
});
