import { describe, expect, it } from "vitest";
import { transformClassString } from "../pipeline.js";
import { migrateUtility } from "./apply.js";

describe("tailwind migrations", () => {
  it("migrates bg-gradient-to-br → bg-linear-to-br", () => {
    const { token, transformation } = migrateUtility("bg-gradient-to-br", {
      enabled: true,
      safeOnly: true,
    });
    expect(token).toBe("bg-linear-to-br");
    expect(transformation?.category).toBe("tailwind-migration");
    expect(transformation?.id).toContain("gradient-direction");
  });

  it("preserves variants and important", () => {
    expect(
      migrateUtility("hover:bg-gradient-to-br", { enabled: true }).token,
    ).toBe("hover:bg-linear-to-br");
    expect(
      migrateUtility("dark:md:bg-gradient-to-br", { enabled: true }).token,
    ).toBe("dark:md:bg-linear-to-br");
    expect(migrateUtility("bg-gradient-to-br!", { enabled: true }).token).toBe(
      "bg-linear-to-br!",
    );
  });

  it("migrates all gradient directions", () => {
    for (const dir of ["t", "tr", "r", "br", "b", "bl", "l", "tl"]) {
      expect(
        migrateUtility(`bg-gradient-to-${dir}`, { enabled: true }).token,
      ).toBe(`bg-linear-to-${dir}`);
    }
  });

  it("is idempotent", () => {
    const once = migrateUtility("bg-gradient-to-br", { enabled: true }).token;
    const twice = migrateUtility(once, { enabled: true });
    expect(twice.token).toBe(once);
    expect(twice.transformation).toBeNull();
  });

  it("pipeline migrations-only skips canonical", () => {
    const r = transformClassString("bg-gradient-to-br max-w-[160px]", {
      migrationsOnly: true,
      migrations: true,
    });
    expect(r.result).toContain("bg-linear-to-br");
    expect(r.result).toContain("max-w-[160px]");
  });
});
