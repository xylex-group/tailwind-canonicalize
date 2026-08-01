import { describe, expect, it } from "vitest";
import { extractClassOccurrences } from "./extract.js";

describe("extractClassOccurrences", () => {
  it("extracts className JSX attributes", () => {
    const src = `export const A = () => <div className="w-[40px] p-4" />`;
    const { occurrences } = extractClassOccurrences(src, { filePath: "a.tsx" });
    expect(occurrences.some((o) => o.raw.includes("w-[40px]"))).toBe(true);
  });

  it("extracts clsx and cn calls", () => {
    const src = `
      import { clsx } from "clsx";
      import { cn } from "@/lib/utils";
      const a = clsx("w-[40px]", condition && "h-[10px]");
      const b = cn("p-[16px]", { "gap-[8px]": true });
    `;
    const { occurrences } = extractClassOccurrences(src, { filePath: "a.tsx" });
    const raws = occurrences.map((o) => o.raw);
    expect(raws).toContain("w-[40px]");
    expect(raws).toContain("h-[10px]");
    expect(raws).toContain("p-[16px]");
    expect(raws).toContain("gap-[8px]");
  });

  it("extracts tw tagged templates", () => {
    const src = `const x = tw\`w-[40px] flex\``;
    const { occurrences } = extractClassOccurrences(src, { filePath: "a.ts" });
    expect(occurrences.some((o) => o.raw.includes("w-[40px]"))).toBe(true);
  });

  it("extracts HTML class attributes", () => {
    const src = `<div class="w-[40px] text-center"></div>`;
    const { occurrences } = extractClassOccurrences(src, { filePath: "a.html" });
    expect(occurrences[0]?.raw).toContain("w-[40px]");
  });

  it("extracts Vue template classes", () => {
    const src = `
      <template>
        <div class="w-[40px]" />
      </template>
      <script setup lang="ts">
      const x = cn("p-[8px]");
      </script>
    `;
    const { occurrences } = extractClassOccurrences(src, { filePath: "A.vue" });
    expect(occurrences.some((o) => o.raw.includes("w-[40px]"))).toBe(true);
    expect(occurrences.some((o) => o.raw.includes("p-[8px]"))).toBe(true);
  });

  it("handles nested arrays and conditionals", () => {
    const src = `cn(["w-[40px]", condition ? "h-[10px]" : "h-[20px]"], { "m-[4px]": ok })`;
    const { occurrences } = extractClassOccurrences(src, { filePath: "a.tsx" });
    const raws = occurrences.map((o) => o.raw);
    expect(raws).toEqual(expect.arrayContaining(["w-[40px]", "h-[10px]", "h-[20px]", "m-[4px]"]));
  });
});
