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

  it("extracts MDX className without oxc parse-error flood", () => {
    const src = `---
title: Docs
---

# Hello

Markdown is **not** TSX. {1 + 2}

<Card className="w-[40px] p-4" title="x" />

\`\`\`tsx
export const A = () => <div className="min-h-[100px]" />
\`\`\`
`;
    const { occurrences, errors, language } = extractClassOccurrences(src, {
      filePath: "page.mdx",
    });
    expect(language).toBe("mdx");
    expect(errors).toHaveLength(0);
    const raws = occurrences.map((o) => o.raw);
    expect(raws.some((r) => r.includes("w-[40px]"))).toBe(true);
    expect(raws.some((r) => r.includes("min-h-[100px]"))).toBe(true);
  });

  it("does not treat pure markdown MDX as parse failure", () => {
    const src = `---
title: Athena
---

Athena is a gateway.

## Section

- item one
- item two
`;
    const { errors, occurrences } = extractClassOccurrences(src, {
      filePath: "index.mdx",
    });
    expect(errors).toHaveLength(0);
    expect(occurrences).toHaveLength(0);
  });

  it("extracts Astro class attributes without script parse-error flood", () => {
    const src = `---
const title = "Hi";
---

<div class="w-[40px] object-cover object-center">
  <span class="font-medium font-display">x</span>
</div>

<script type="application/ld+json">
{"@context":"https://schema.org"}
</script>

<script>
  // incomplete fragment that would oxc-error if parsed as module body
  return 1;
</script>
`;
    const { occurrences, errors, language } = extractClassOccurrences(src, {
      filePath: "Card.astro",
    });
    expect(language).toBe("astro");
    expect(errors).toHaveLength(0);
    const raws = occurrences.map((o) => o.raw);
    expect(raws.some((r) => r.includes("w-[40px]"))).toBe(true);
    expect(raws.some((r) => r.includes("object-cover"))).toBe(true);
  });
});
