import { describe, expect, it } from "vitest";
import { createDefaultTheme } from "./default-theme.js";
import { dedupeClassTokens } from "./dedupe.js";
import { transformClassString } from "./pipeline.js";
import { utilitiesConflict, utilityIdentity } from "./utility-identity.js";

describe("safety review fixes", () => {
  describe("text property families", () => {
    it("does not conflict alignment vs size vs color", () => {
      expect(utilitiesConflict("text-center", "text-muted-foreground")).toBe(
        false,
      );
      expect(utilitiesConflict("text-body-sm", "text-foreground")).toBe(false);
      expect(utilitiesConflict("text-caption", "text-muted-foreground")).toBe(
        false,
      );
      expect(utilitiesConflict("text-xs", "text-foreground")).toBe(false);
      expect(utilitiesConflict("text-balance", "text-sm")).toBe(false);

      expect(utilityIdentity("text-center").propertyGroup).toBe("text-align");
      expect(utilityIdentity("text-body-sm").propertyGroup).toBe("font-size");
      expect(utilityIdentity("text-caption").propertyGroup).toBe("font-size");
      expect(utilityIdentity("text-muted-foreground").propertyGroup).toBe(
        "text-color",
      );
      expect(utilityIdentity("text-foreground").propertyGroup).toBe("text-color");
    });

    it("still conflicts same-family colors", () => {
      expect(
        utilitiesConflict("text-foreground", "text-muted-foreground"),
      ).toBe(true);
    });
  });

  describe("flex property families", () => {
    it("does not conflict flex / flex-col / flex-1 / flex-wrap", () => {
      expect(utilitiesConflict("flex", "flex-col")).toBe(false);
      expect(utilitiesConflict("flex", "flex-1")).toBe(false);
      expect(utilitiesConflict("flex", "flex-wrap")).toBe(false);
      expect(utilitiesConflict("flex-col", "flex-1")).toBe(false);

      expect(utilityIdentity("flex").propertyGroup).toBe("display");
      expect(utilityIdentity("flex-col").propertyGroup).toBe("flex-direction");
      expect(utilityIdentity("flex-1").propertyGroup).toBe("flex");
      expect(utilityIdentity("flex-wrap").propertyGroup).toBe("flex-wrap");
    });
  });

  describe("border width vs color", () => {
    it("does not conflict border width with border-border color", () => {
      expect(utilitiesConflict("border", "border-border")).toBe(false);
      expect(utilitiesConflict("border-b", "border-border")).toBe(false);
      expect(utilitiesConflict("border-2", "border-primary")).toBe(false);
      expect(utilitiesConflict("border-b", "border-r")).toBe(false);

      expect(utilityIdentity("border").propertyGroup).toBe("border-width");
      expect(utilityIdentity("border-border").propertyGroup).toBe("border-color");
      expect(utilityIdentity("border-b").propertyGroup).toBe("border-b-width");
      expect(utilityIdentity("border-r").propertyGroup).toBe("border-r-width");
    });
  });

  describe("detectConflicts independent of collapseEquivalent", () => {
    it("reports conflicts when collapse is disabled", () => {
      const r = dedupeClassTokens(["max-w-40", "max-w-44"], {
        theme: createDefaultTheme(),
        collapseEquivalent: false,
        detectConflicts: true,
      });
      expect(r.diagnostics.some((d) => d.kind === "conflict")).toBe(true);
      expect(r.tokens).toEqual(["max-w-40", "max-w-44"]);
    });

    it("can disable conflict detection while still collapsing", () => {
      const r = dedupeClassTokens(["max-w-40", "max-w-[160px]"], {
        theme: createDefaultTheme(),
        collapseEquivalent: true,
        detectConflicts: false,
      });
      expect(r.diagnostics).toHaveLength(0);
      expect(r.tokens).toEqual(["max-w-40"]);
    });
  });

  describe("duplicate-removal original tokens", () => {
    it("records the original arbitrary class before mutation", () => {
      const r = dedupeClassTokens(["w-[40px]", "w-10"], {
        theme: createDefaultTheme(),
        collapseEquivalent: true,
      });
      const collapse = r.transformations.find(
        (t) => t.category === "duplicate-token-removal" && t.replacement === "w-10",
      );
      expect(collapse).toBeDefined();
      expect(collapse!.original).toBe("w-[40px] w-10");
      expect(collapse!.original).not.toBe("w-10 w-10");
      expect(r.tokens).toEqual(["w-10"]);
    });
  });

  describe("pipeline smoke", () => {
    it("does not flag common co-occurring text utilities as conflicts", () => {
      const r = transformClassString(
        "text-center text-body-sm text-muted-foreground flex flex-col flex-1 border border-border",
        { theme: createDefaultTheme() },
      );
      expect(r.diagnostics.filter((d) => d.kind === "conflict")).toHaveLength(0);
    });
  });
});
