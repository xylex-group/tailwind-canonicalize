import { createDefaultTheme } from "@tailwind-canonicalize/resolver";
import { describe, expect, it } from "vitest";
import { transformSource } from "./transform.js";

describe("transformSource", () => {
  const theme = createDefaultTheme();

  it("rewrites JSX className multi-line strings", () => {
    const src = `<div
  className="
    w-[40px]
    min-w-[10rem]
    h-[10px]
    p-[16px]
    gap-[8px]
"
/>`;
    const result = transformSource(src, { filePath: "a.tsx", theme });
    expect(result.changed).toBe(true);
    expect(result.code).toContain("w-10");
    expect(result.code).toContain("min-w-40");
    expect(result.code).toContain("h-2.5");
    expect(result.code).toContain("p-4");
    expect(result.code).toContain("gap-2");
    expect(result.code).not.toContain("w-[40px]");
  });

  it("preserves non-class code", () => {
    const src = `const n = 40;\n<div className="w-[40px]" data-x={n} />`;
    const result = transformSource(src, { filePath: "a.tsx", theme });
    expect(result.code).toContain("const n = 40");
    expect(result.code).toContain('className="w-10"');
  });

  it("is a no-op for already canonical classes", () => {
    const src = `<div className="w-10 p-4 flex" />`;
    const result = transformSource(src, { filePath: "a.tsx", theme });
    expect(result.changed).toBe(false);
    expect(result.code).toBe(src);
  });

  it("rewrites Astro class:list and frontmatter with TSX parity", () => {
    const src = `---
const box = cn("w-[40px] p-[16px]");
---
<div class:list={["h-[10px] gap-[8px]", { "min-w-[10rem]": ok }]}>{box}</div>
`;
    const result = transformSource(src, { filePath: "Card.astro", theme });
    expect(result.changed).toBe(true);
    expect(result.code).toContain('cn("w-10 p-4")');
    expect(result.code).toContain('"h-2.5 gap-2"');
    expect(result.code).toContain('"min-w-40"');
    expect(result.code).not.toContain("w-[40px]");
    expect(result.code).not.toContain("h-[10px]");
  });
});
