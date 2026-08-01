import { describe, expect, it } from "vitest";
import {
  emptyCache,
  hashContent,
  hashOptions,
  isFileFresh,
  markFile,
} from "./hash-cache.js";

describe("incremental hash cache", () => {
  it("hashes content stably", () => {
    expect(hashContent("a")).toBe(hashContent("a"));
    expect(hashContent("a")).not.toBe(hashContent("b"));
  });

  it("options hash changes with options", () => {
    expect(hashOptions({ a: 1 })).toBe(hashOptions({ a: 1 }));
    expect(hashOptions({ a: 1 })).not.toBe(hashOptions({ a: 2 }));
    expect(hashOptions({ a: 1, b: 2 })).toBe(hashOptions({ b: 2, a: 1 }));
  });

  it("freshness requires matching content + options", () => {
    const opt = hashOptions({ mode: "safe" });
    const cache = emptyCache(opt);
    markFile(cache, "/x.tsx", hashContent("hello"), opt);
    expect(isFileFresh(cache, "/x.tsx", hashContent("hello"), opt)).toBe(true);
    expect(isFileFresh(cache, "/x.tsx", hashContent("hello!"), opt)).toBe(false);
    expect(
      isFileFresh(cache, "/x.tsx", hashContent("hello"), hashOptions({ mode: "aggressive" })),
    ).toBe(false);
  });
});
