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

  describe("object-fit vs object-position / bg size vs position / plugins", () => {
    it("does not conflict object-cover with object-center", () => {
      expect(utilityIdentity("object-cover").propertyGroup).toBe("object-fit");
      expect(utilityIdentity("object-center").propertyGroup).toBe(
        "object-position",
      );
      expect(utilityIdentity("object-top").propertyGroup).toBe("object-position");
      expect(utilitiesConflict("object-cover", "object-center")).toBe(false);
      expect(utilitiesConflict("object-top", "object-cover")).toBe(false);
      expect(utilitiesConflict("object-cover", "object-contain")).toBe(true);
    });

    it("does not conflict bg-center with bg-cover", () => {
      expect(utilityIdentity("bg-center").propertyGroup).toBe(
        "background-position",
      );
      expect(utilityIdentity("bg-cover").propertyGroup).toBe("background-size");
      expect(utilitiesConflict("bg-center", "bg-cover")).toBe(false);
      expect(utilitiesConflict("bg-background", "bg-primary")).toBe(true);
    });

    it("does not conflict iconify icon + icon-tabler co-classes", () => {
      expect(utilitiesConflict("icon", "icon-tabler")).toBe(false);
      expect(utilitiesConflict("icon-tabler", "icon-tabler-home")).toBe(false);
    });

    it("does not conflict font-medium (weight) with font-display (family)", () => {
      expect(utilitiesConflict("font-medium", "font-display")).toBe(false);
      expect(utilitiesConflict("font-light", "font-display")).toBe(false);
    });

    it("does not treat text-base-500 palette colors as font-size", () => {
      expect(utilityIdentity("text-base").propertyGroup).toBe("font-size");
      expect(utilityIdentity("text-base-500").propertyGroup).toBe("text-color");
      expect(utilityIdentity("text-base-400").propertyGroup).toBe("text-color");
      expect(utilitiesConflict("text-base-500", "text-xs")).toBe(false);
      expect(utilitiesConflict("text-base", "text-base-400")).toBe(false);
      expect(utilitiesConflict("text-sm", "text-xs")).toBe(true);
    });

    it("does not conflict list-inside (position) with list-disc/decimal (type)", () => {
      expect(utilityIdentity("list-inside").propertyGroup).toBe(
        "list-style-position",
      );
      expect(utilityIdentity("list-disc").propertyGroup).toBe("list-style-type");
      expect(utilityIdentity("list-decimal").propertyGroup).toBe(
        "list-style-type",
      );
      expect(utilitiesConflict("list-inside", "list-disc")).toBe(false);
      expect(utilitiesConflict("list-inside", "list-decimal")).toBe(false);
      expect(utilitiesConflict("list-disc", "list-decimal")).toBe(true);
    });

    it("does not conflict border-collapse with border-border color", () => {
      expect(utilityIdentity("border-collapse").propertyGroup).toBe(
        "border-collapse",
      );
      expect(utilityIdentity("border-border").propertyGroup).toBe("border-color");
      expect(utilitiesConflict("border-collapse", "border-border")).toBe(false);
      expect(utilitiesConflict("border-separate", "border-collapse")).toBe(true);
    });

    it("does not conflict font-bold (weight) with font-mono (family)", () => {
      expect(utilitiesConflict("font-bold", "font-mono")).toBe(false);
    });

    it("does not conflict outline width with outline color", () => {
      expect(utilityIdentity("outline-1").propertyGroup).toBe("outline-width");
      expect(utilityIdentity("outline-ring").propertyGroup).toBe("outline-color");
      expect(utilityIdentity("outline-hidden").propertyGroup).toBe(
        "outline-style",
      );
      expect(utilityIdentity("outline-0").propertyGroup).toBe("outline-width");
      expect(
        utilitiesConflict("focus-visible:outline-1", "focus-visible:outline-ring"),
      ).toBe(false);
      // width vs style — independent cascade slots
      expect(utilitiesConflict("outline-hidden", "outline-0")).toBe(false);
    });

    it("does not conflict shadow size with shadow color", () => {
      expect(utilityIdentity("shadow-sm").propertyGroup).toBe("box-shadow");
      expect(utilityIdentity("shadow-border/10").propertyGroup).toBe(
        "box-shadow-color",
      );
      expect(utilitiesConflict("shadow-sm", "shadow-border/10")).toBe(false);
      // both elevations still conflict
      expect(utilitiesConflict("shadow-sm", "shadow-lg")).toBe(true);
    });

    it("does not conflict display:grid with custom grid-tables / grid-kpis", () => {
      expect(utilityIdentity("grid").propertyGroup).toBe("display");
      expect(utilityIdentity("grid-tables").propertyGroup).toMatch(/^plugin:grid:/);
      expect(utilitiesConflict("grid", "grid-tables")).toBe(false);
      expect(utilitiesConflict("grid", "grid-kpis")).toBe(false);
      expect(utilitiesConflict("grid-cols-2", "grid-cols-3")).toBe(true);
    });

    it("does not conflict overflow-stable (plugin) with overflow-auto", () => {
      expect(utilityIdentity("overflow-auto").propertyGroup).toBe("overflow");
      expect(utilityIdentity("overflow-stable").propertyGroup).toMatch(
        /^plugin:overflow:/,
      );
      expect(utilitiesConflict("overflow-stable", "overflow-auto")).toBe(false);
      expect(utilitiesConflict("overflow-auto", "overflow-hidden")).toBe(true);
    });

    it("classifies text-[clamp]/length:] as font-size not color", () => {
      expect(
        utilityIdentity("text-[clamp(32px,7vw,64px)]").propertyGroup,
      ).toBe("font-size");
      expect(
        utilityIdentity("text-[length:var(--heading-size)]").propertyGroup,
      ).toBe("font-size");
      expect(
        utilitiesConflict(
          "text-text-primary",
          "text-[clamp(32px,7vw,64px)]",
        ),
      ).toBe(false);
      expect(
        utilitiesConflict(
          "text-[length:var(--heading-size)]",
          "text-text-primary",
        ),
      ).toBe(false);
    });

    it("does not conflict border-px (width) with border-current (color)", () => {
      expect(utilityIdentity("border-px").propertyGroup).toBe("border-width");
      expect(utilityIdentity("border-current").propertyGroup).toBe(
        "border-color",
      );
      expect(utilitiesConflict("border-px", "border-current")).toBe(false);
    });

    it("does not conflict bg-gray-100 with legacy bg-opacity-30", () => {
      expect(utilityIdentity("bg-opacity-30").propertyGroup).toBe(
        "background-opacity",
      );
      expect(
        utilitiesConflict("hover:bg-gray-100", "hover:bg-opacity-30"),
      ).toBe(false);
    });

    it("does not conflict bare outline with outline-2 / outline-white", () => {
      expect(utilityIdentity("outline").propertyGroup).toBe("outline-style");
      expect(utilityIdentity("outline-2").propertyGroup).toBe("outline-width");
      expect(utilityIdentity("outline-white").propertyGroup).toBe(
        "outline-color",
      );
      expect(
        utilitiesConflict("focus-visible:outline", "focus-visible:outline-2"),
      ).toBe(false);
      expect(
        utilitiesConflict(
          "focus-visible:outline-2",
          "focus-visible:outline-white",
        ),
      ).toBe(false);
    });

    it("classifies font-small / font-smaller as font-size keywords", () => {
      expect(utilityIdentity("font-small").propertyGroup).toBe("font-size");
      expect(utilityIdentity("font-smaller").propertyGroup).toBe("font-size");
      // same slot — true conflict if both present
      expect(utilitiesConflict("font-small", "font-smaller")).toBe(true);
      expect(utilitiesConflict("font-small", "font-mono")).toBe(false);
    });

    it("does not conflict border-bottom-color with border-left-color", () => {
      expect(utilityIdentity("border-bottom-color").propertyGroup).toBe(
        "border-bottom-color",
      );
      expect(utilityIdentity("border-left-color").propertyGroup).toBe(
        "border-left-color",
      );
      expect(
        utilitiesConflict("border-bottom-color", "border-left-color"),
      ).toBe(false);
    });

    it("does not conflict ring-black with legacy ring-opacity-5", () => {
      expect(utilityIdentity("ring-opacity-5").propertyGroup).toBe(
        "ring-opacity",
      );
      expect(utilitiesConflict("ring-black", "ring-opacity-5")).toBe(false);
      expect(
        utilitiesConflict("ring-purple-600", "ring-opacity-100"),
      ).toBe(false);
    });

    it("classifies text-bold as weight and text-m/text-small as size", () => {
      expect(utilityIdentity("text-bold").propertyGroup).toBe("font-weight");
      expect(utilityIdentity("text-m").propertyGroup).toBe("font-size");
      expect(utilityIdentity("text-small").propertyGroup).toBe("font-size");
      expect(utilitiesConflict("text-bold", "text-white")).toBe(false);
      expect(utilitiesConflict("text-m", "text-white")).toBe(false);
      expect(utilitiesConflict("text-bold", "text-small")).toBe(false);
    });

    it("classifies border-md / border-small as width not color", () => {
      expect(utilityIdentity("border-md").propertyGroup).toBe("border-width");
      expect(utilityIdentity("border-small").propertyGroup).toBe("border-width");
      expect(utilitiesConflict("border-md", "border-gray-500")).toBe(false);
      expect(utilitiesConflict("border-small", "border-default-200")).toBe(
        false,
      );
    });
  });

  describe("extended type scale / font / divide / bg subproperties", () => {
    it("does not conflict text-2xs (font-size) with text-muted-foreground (color)", () => {
      expect(utilityIdentity("text-2xs").propertyGroup).toBe("font-size");
      expect(utilityIdentity("text-muted-foreground").propertyGroup).toBe(
        "text-color",
      );
      expect(utilitiesConflict("text-2xs", "text-muted-foreground")).toBe(false);
      expect(utilitiesConflict("text-2xs", "text-primary")).toBe(false);
    });

    it("does not conflict font-mono (family) with font-medium (weight)", () => {
      expect(utilityIdentity("font-mono").propertyGroup).toBe("font-family");
      expect(utilityIdentity("font-medium").propertyGroup).toBe("font-weight");
      expect(utilitiesConflict("font-mono", "font-medium")).toBe(false);
      // same family still conflicts
      expect(utilitiesConflict("font-mono", "font-sans")).toBe(true);
      expect(utilitiesConflict("font-medium", "font-bold")).toBe(true);
    });

    it("does not conflict divide-y (axis) with divide-border (color)", () => {
      expect(utilityIdentity("divide-y").propertyGroup).toBe("divide-y");
      expect(utilityIdentity("divide-border").propertyGroup).toBe("divide-color");
      expect(utilityIdentity("divide-border/50").propertyGroup).toBe(
        "divide-color",
      );
      expect(utilitiesConflict("divide-y", "divide-border")).toBe(false);
      expect(utilitiesConflict("divide-y", "divide-border/50")).toBe(false);
      expect(utilitiesConflict("divide-border", "divide-primary")).toBe(true);
    });

    it("does not conflict bg color with bg-clip-*", () => {
      expect(utilityIdentity("bg-clip-padding").propertyGroup).toBe(
        "background-clip",
      );
      expect(utilityIdentity("bg-background").propertyGroup).toBe(
        "background-color",
      );
      expect(utilityIdentity("bg-(--frame-panel-bg)").propertyGroup).toBe(
        "background-color",
      );
      expect(
        utilitiesConflict("bg-(--frame-panel-bg)", "bg-clip-padding"),
      ).toBe(false);
      expect(utilitiesConflict("bg-background", "bg-clip-padding")).toBe(false);
      expect(utilitiesConflict("bg-background", "bg-primary")).toBe(true);
    });

    it("pipeline: common co-occurring false-positive pairs stay silent", () => {
      const r = transformClassString(
        "text-2xs text-muted-foreground font-mono font-medium divide-y divide-border bg-background bg-clip-padding",
        { theme: createDefaultTheme() },
      );
      expect(r.diagnostics.filter((d) => d.kind === "conflict")).toHaveLength(0);
    });
  });
});
