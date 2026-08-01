import { performance } from "node:perf_hooks";
import {
  canonicalizeClassString,
  createDefaultTheme,
  findCanonicalEquivalent,
} from "../packages/resolver/src/index.ts";
import { transformSource } from "../packages/transformer/src/index.ts";

const theme = createDefaultTheme();
const cache = new Map();

const samples = [
  "w-[40px]",
  "h-[10px]",
  "p-[16px]",
  "gap-[8px]",
  "min-w-[10rem]",
  "rounded-[8px]",
  "text-[16px]",
  "hover:md:w-[40px]",
  "w-[100%]",
  "h-[100vh]",
  "w-[50%]",
  "w-[13px]",
  "w-[calc(100%-1rem)]",
  "flex",
  "items-center",
];

const classString = samples.join(" ");

// Warmup
for (let i = 0; i < 1000; i++) {
  findCanonicalEquivalent(samples[i % samples.length]!, { theme, cache });
}

const N = 50_000;
const t0 = performance.now();
for (let i = 0; i < N; i++) {
  findCanonicalEquivalent(samples[i % samples.length]!, { theme, cache });
}
const t1 = performance.now();

const t2 = performance.now();
for (let i = 0; i < 10_000; i++) {
  canonicalizeClassString(classString, { theme, cache });
}
const t3 = performance.now();

const file = `<div className="${classString} ${classString}" />\n`.repeat(200);
const t4 = performance.now();
for (let i = 0; i < 200; i++) {
  transformSource(file, { filePath: "bench.tsx", theme, cache });
}
const t5 = performance.now();

console.log("tailwind-canonicalize benchmarks");
console.log(`  findCanonicalEquivalent x${N}: ${(t1 - t0).toFixed(2)}ms`);
console.log(`    ${(N / ((t1 - t0) / 1000)).toFixed(0)} ops/sec (with cache)`);
console.log(`  canonicalizeClassString x10000: ${(t3 - t2).toFixed(2)}ms`);
console.log(`  transformSource (200 lines) x200: ${(t5 - t4).toFixed(2)}ms`);
