import { defineConfig } from "tsup";

const workspacePackages = [
  "@tailwind-canonicalize/compiler",
  "@tailwind-canonicalize/parser",
  "@tailwind-canonicalize/resolver",
  "@tailwind-canonicalize/tokens",
  "@tailwind-canonicalize/transformer",
];

const shared = {
  format: ["esm"] as const,
  platform: "node" as const,
  target: "node20",
  sourcemap: true,
  splitting: false,
  treeshake: true,
  // Bundle monorepo packages into the published tarball (single npm package).
  noExternal: workspacePackages,
  // Real third-party runtime deps stay external and are declared on package.json.
  external: ["oxc-parser", "magic-string", "tailwindcss"],
};

export default defineConfig([
  {
    ...shared,
    entry: { index: "src/index.ts" },
    dts: true,
    tsconfig: "tsconfig.build.json",
    clean: true,
  },
  {
    ...shared,
    entry: { bin: "src/bin.ts" },
    dts: false,
    tsconfig: "tsconfig.build.json",
    clean: false,
    banner: { js: "#!/usr/bin/env node" },
  },
  {
    ...shared,
    entry: { worker: "../compiler/src/worker.ts" },
    dts: false,
    tsconfig: "tsconfig.build.json",
    clean: false,
  },
]);
