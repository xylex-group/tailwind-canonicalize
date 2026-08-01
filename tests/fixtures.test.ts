import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalizeSource,
  createDefaultTheme,
} from "@tailwind-canonicalize/compiler";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesRoot = path.join(here, "..", "fixtures");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (
      entry.name.endsWith(".input.tsx") ||
      entry.name.endsWith(".input.html") ||
      entry.name.endsWith(".input.vue") ||
      entry.name.endsWith(".input.astro")
    ) {
      out.push(full);
    }
  }
  return out;
}

describe("fixtures", () => {
  const theme = createDefaultTheme();
  const inputs = walk(fixturesRoot);

  it("has fixture inputs", () => {
    expect(inputs.length).toBeGreaterThan(0);
  });

  for (const inputPath of inputs) {
    const name = path.relative(fixturesRoot, inputPath);
    it(name, () => {
      const expectedPath = inputPath.replace(".input.", ".output.");
      const input = readFileSync(inputPath, "utf8");
      const expected = readFileSync(expectedPath, "utf8");
      const result = canonicalizeSource(input, {
        filePath: inputPath,
        theme,
      });
      expect(result.code).toBe(expected);
    });
  }
});
