import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@tailwind-canonicalize/parser": path.join(root, "packages/parser/src/index.ts"),
      "@tailwind-canonicalize/resolver": path.join(root, "packages/resolver/src/index.ts"),
      "@tailwind-canonicalize/transformer": path.join(root, "packages/transformer/src/index.ts"),
      "@tailwind-canonicalize/compiler": path.join(root, "packages/compiler/src/index.ts"),
      "@tailwind-canonicalize/tokens": path.join(root, "packages/tokens/src/index.ts"),
      "tailwind-canonicalize": path.join(root, "packages/cli/src/index.ts"),
    },
  },
  test: {
    include: [
      "packages/**/src/**/*.test.ts",
      "packages/**/tests/**/*.test.ts",
      "tests/**/*.test.ts",
    ],
    environment: "node",
    pool: "forks",
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["packages/*/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/dist/**"],
    },
  },
});
