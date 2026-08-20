/**
 * Close law for workspace / release / generate ownership (desired after consolidation).
 * Must fail on CURRENT split authorities; pass only when superseded paths are gone.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type MemberClass = "internal" | "publishable" | "integration" | "app" | "tooling";

const MEMBER_CLASS = {
  "packages/parser": "internal",
  "packages/resolver": "internal",
  "packages/transformer": "internal",
  "packages/tokens": "internal",
  "packages/compiler": "internal",
  "packages/cli": "publishable",
  "packages/vscode": "integration",
  "apps/docs": "app",
  action: "tooling",
} as const satisfies Record<string, MemberClass>;

const MEMBER_DIRS = Object.keys(MEMBER_CLASS);

const INTERNAL_DIRS = MEMBER_DIRS.filter(
  (dir) => MEMBER_CLASS[dir as keyof typeof MEMBER_CLASS] === "internal",
);

function readText(rel: string): string {
  return readFileSync(path.join(repoRoot, rel), "utf8");
}

function readJson(rel: string): Record<string, unknown> {
  return JSON.parse(readText(rel)) as Record<string, unknown>;
}

function gitLsFiles(rel: string): string[] {
  const out = execFileSync("git", ["ls-files", rel], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return out.split(/\r?\n/).filter(Boolean);
}

function workflowFiles(): string[] {
  const dir = path.join(repoRoot, ".github/workflows");
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir)
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .map((name) => path.posix.join(".github/workflows", name));
}

function classifyMember(
  dir: string,
  pkg: Record<string, unknown>,
): MemberClass | "quasi-publishable" | "unclassified" {
  const name = String(pkg.name ?? "");
  const isPrivate = pkg.private === true;
  const hasPublishConfig = Object.hasOwn(pkg, "publishConfig");
  const expected = MEMBER_CLASS[dir as keyof typeof MEMBER_CLASS];

  if (isPrivate && hasPublishConfig) {
    return "quasi-publishable";
  }
  if (
    expected === "internal" &&
    isPrivate &&
    !hasPublishConfig &&
    name.startsWith("@tailwind-canonicalize/")
  ) {
    return "internal";
  }
  if (
    dir === "packages/cli" &&
    name === "tailwind-canonicalize" &&
    !isPrivate &&
    hasPublishConfig
  ) {
    return "publishable";
  }
  if (dir === "packages/vscode" && name === "tailwind-canonicalize-vscode" && isPrivate) {
    return "integration";
  }
  if (dir === "apps/docs" && name === "docs" && isPrivate) {
    return "app";
  }
  if (dir === "action" && name === "tailwind-canonicalize-action" && isPrivate) {
    return "tooling";
  }
  return "unclassified";
}

function xbpServiceNames(xbp: string): string[] {
  const names: string[] = [];
  for (const block of xbp.split(/^\[\[services\]\]/m).slice(1)) {
    const match = block.match(/^name = "([^"]+)"/m);
    if (match) {
      names.push(match[1]);
    }
  }
  return names;
}

function ignoreMentionsBlume(gitignore: string): boolean {
  return gitignore.split(/\r?\n/).some((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return false;
    }
    return (
      trimmed === ".blume" ||
      trimmed === ".blume/" ||
      trimmed === "**/.blume/" ||
      trimmed === "apps/docs/.blume/" ||
      trimmed === "apps/docs/.blume" ||
      trimmed === ".blume/**"
    );
  });
}

describe("workspace-governance target (close law)", () => {
  describe("one class per pnpm-workspace member", () => {
    it("keeps the same nine members and layered package dirs (no new topology)", () => {
      const yaml = readText("pnpm-workspace.yaml");
      expect(yaml).toContain("packages/*");
      expect(yaml).toContain("apps/*");
      expect(yaml).toContain("action");
      expect(MEMBER_DIRS).toHaveLength(9);
      for (const dir of MEMBER_DIRS) {
        expect(existsSync(path.join(repoRoot, dir, "package.json"))).toBe(true);
      }
      expect(existsSync(path.join(repoRoot, "turbo.json"))).toBe(false);
      const root = readJson("package.json");
      const devDependencies = (root.devDependencies as Record<string, string> | undefined) ?? {};
      expect(devDependencies).not.toHaveProperty("turbo");
    });

    it("assigns exactly one class in {internal, publishable, integration, app, tooling}", () => {
      const classes = Object.values(MEMBER_CLASS);
      expect(new Set(classes).size).toBe(5);
      expect(classes.filter((c) => c === "internal")).toHaveLength(5);
      expect(classes.filter((c) => c === "publishable")).toHaveLength(1);
      expect(classes.filter((c) => c === "integration")).toHaveLength(1);
      expect(classes.filter((c) => c === "app")).toHaveLength(1);
      expect(classes.filter((c) => c === "tooling")).toHaveLength(1);

      for (const dir of MEMBER_DIRS) {
        const pkg = readJson(path.join(dir, "package.json"));
        const classified = classifyMember(dir, pkg);
        expect(classified).toBe(MEMBER_CLASS[dir as keyof typeof MEMBER_CLASS]);
        expect(classified).not.toBe("quasi-publishable");
        expect(classified).not.toBe("unclassified");
      }
    });

    it("keeps internals private with exports and without publishConfig", () => {
      expect(INTERNAL_DIRS).toEqual([
        "packages/parser",
        "packages/resolver",
        "packages/transformer",
        "packages/tokens",
        "packages/compiler",
      ]);
      for (const dir of INTERNAL_DIRS) {
        const pkg = readJson(path.join(dir, "package.json"));
        expect(pkg.private).toBe(true);
        expect(pkg).not.toHaveProperty("publishConfig");
        expect(pkg.exports).toBeTypeOf("object");
      }
    });

    it("makes tailwind-canonicalize the only publishable / Changesets npm package", () => {
      const cli = readJson("packages/cli/package.json");
      expect(cli.name).toBe("tailwind-canonicalize");
      expect(cli).not.toHaveProperty("private");
      expect((cli.publishConfig as { access?: string }).access).toBe("public");

      const changeset = readJson(".changeset/config.json");
      const ignore = changeset.ignore as string[];
      const memberNames = MEMBER_DIRS.map((dir) =>
        String(readJson(path.join(dir, "package.json")).name),
      );
      const published = memberNames.filter((name) => !ignore.includes(name));
      expect(published).toEqual(["tailwind-canonicalize"]);

      for (const dir of ["packages/vscode", "apps/docs", "action"] as const) {
        const pkg = readJson(path.join(dir, "package.json"));
        expect(pkg.private).toBe(true);
        expect(pkg).not.toHaveProperty("publishConfig");
      }
    });
  });

  describe("packageManager is the only Node execution authority", () => {
    it("pins pnpm only via package.json#packageManager", () => {
      const root = readJson("package.json");
      expect(root.packageManager).toBe("pnpm@9.15.0");
      expect((root.scripts as Record<string, string>).check).toContain("ultracite check");
    });

    it("CI uses that pin and invokes pnpm check rather than reconstructing biome", () => {
      const ci = readText(".github/workflows/ci.yml");
      expect(ci).not.toMatch(/version:\s*9\b/);
      expect(ci).toContain("pnpm check");
      expect(ci).not.toContain("pnpm exec biome check packages tests");
      expect(ci).toContain("pnpm typecheck");
      expect(ci).toContain("pnpm test");
      expect(ci).toContain("pnpm build");

      for (const file of workflowFiles()) {
        const text = readText(file);
        expect(text).not.toMatch(/version:\s*9\b/);
      }
    });
  });

  describe("Changesets is the only npm version authority", () => {
    it("retires semantic-release workflows", () => {
      for (const file of workflowFiles()) {
        const text = readText(file);
        expect(text).not.toMatch(/semantic-release/);
      }
      expect(existsSync(path.join(repoRoot, ".github/workflows/release.yml"))).toBe(false);
    });

    it("retires XBP [publish.npm] and directory-as-service mappings", () => {
      const xbp = readText(".xbp/xbp.toml");
      expect(xbp).not.toMatch(/^\[publish\.npm\]/m);
      expect(xbp).not.toContain("npm publish --access public");
      expect(xbp.match(/^\[\[services\]\]/gm) ?? []).toEqual([]);
      expect(xbpServiceNames(xbp)).toEqual([]);
      expect(xbp).not.toMatch(/^name = "public"$/m);
      expect(xbp).not.toContain('root_directory = "apps/docs/public"');

      for (const target of [
        "action/package.json",
        "apps/docs/package.json",
        "packages/cli/package.json",
        "packages/compiler/package.json",
        "packages/parser/package.json",
        "packages/resolver/package.json",
        "packages/tokens/package.json",
        "packages/transformer/package.json",
        "packages/vscode/package.json",
      ]) {
        expect(xbp).not.toContain(`"${target}"`);
      }
    });

    it("keeps XBP as ledger and docs worker orchestration only", () => {
      const xbp = readText(".xbp/xbp.toml");
      expect(xbp).toMatch(/^\[\[workers\]\]/m);
      expect(xbp).toContain("tailwind-canonicalize-docs");
      expect(existsSync(path.join(repoRoot, ".xbp/releases"))).toBe(true);
      expect(existsSync(path.join(repoRoot, ".xbp/versioning/history.jsonl"))).toBe(true);
    });

    it("does not advertise root version as the npm current version", () => {
      const root = readJson("package.json");
      const cli = readJson("packages/cli/package.json");
      const readme = readText("README.md");
      expect(cli.version).toBeTypeOf("string");
      expect(readme).toContain(`**current:** \`${String(cli.version)}\``);
      if (root.version !== cli.version) {
        expect(readme).not.toContain(`current version: \`${String(root.version)}\``);
      }
    });
  });

  describe("generated outputs", () => {
    it("ignores or CI-proves apps/docs/.blume; dist and .wrangler stay ignored", () => {
      const rootIgnore = readText(".gitignore");
      const docsIgnore = existsSync(path.join(repoRoot, "apps/docs/.gitignore"))
        ? readText("apps/docs/.gitignore")
        : "";
      const ci = readText(".github/workflows/ci.yml");
      const blumeIgnored = ignoreMentionsBlume(rootIgnore) || ignoreMentionsBlume(docsIgnore);
      const ciProvesGenerate = ci.includes("git diff --exit-code");
      expect(blumeIgnored || ciProvesGenerate).toBe(true);
      if (blumeIgnored) {
        expect(gitLsFiles("apps/docs/.blume")).toEqual([]);
      }

      expect(rootIgnore).toMatch(/^dist$/m);
      expect(rootIgnore).toContain("**/.wrangler/");
      expect(gitLsFiles("dist")).toEqual([]);
      expect(gitLsFiles("apps/docs/dist")).toEqual([]);
    });
  });

  describe("composite Action is the only Action architecture", () => {
    it("ships action.yml composite and retires unused action/src tsc", () => {
      const actionYml = readText("action/action.yml");
      expect(actionYml).toMatch(/using:\s*composite/);
      expect(existsSync(path.join(repoRoot, "action/src/index.ts"))).toBe(false);
      expect(existsSync(path.join(repoRoot, "action/tsconfig.json"))).toBe(false);
      const action = readJson("action/package.json");
      const scripts = (action.scripts as Record<string, string> | undefined) ?? {};
      expect(scripts.build).not.toBe("tsc -p tsconfig.json");
    });
  });

  describe("compatibility-only until 2026-10-01", () => {
    it("documents CLI dual surface, tsup compiler worker, and vitest aliases with sunset", () => {
      const contributing = readText("docs/guides/contributing.md");
      expect(contributing).toContain("2026-10-01");
      expect(contributing).toMatch(/dual|bin|exports/i);
      expect(contributing).toMatch(/tsup|worker/i);
      expect(contributing).toMatch(/vitest|alias/i);

      const tsup = readText("packages/cli/tsup.config.ts");
      expect(tsup).toContain("../compiler/src/worker.ts");
      const vitest = readText("vitest.config.ts");
      expect(vitest).toContain("packages/cli/src/index.ts");
      const cli = readJson("packages/cli/package.json");
      expect(cli.bin).toBeTypeOf("object");
      expect(cli.exports).toBeTypeOf("object");
    });
  });

  describe("ADR and uniqueness pins", () => {
    it("records Changesets-only versioning, XBP ledger/orchestration, and one class per member as accepted", () => {
      const adr = readText("docs/adr/0001-workspace-release-ownership.md");
      expect(adr).toMatch(/\*\*Status:\*\*\s*accepted/i);
      expect(adr).toMatch(/Changesets is the only npm version authority/);
      expect(adr).toMatch(/ledger/);
      expect(adr).toMatch(/one class per/i);
    });

    it("adds no dedicated SDD binary, tests/sdd tree, or extra public npm name", () => {
      const root = readJson("package.json");
      const scripts = (root.scripts as Record<string, string>) ?? {};
      expect(Object.keys(scripts).filter((key) => /sdd/i.test(key))).toEqual([]);
      expect(existsSync(path.join(repoRoot, "tests/sdd"))).toBe(false);

      const memberNames = MEMBER_DIRS.map((dir) =>
        String(readJson(path.join(dir, "package.json")).name),
      );
      const publicNames = memberNames.filter((name) => {
        const dir = MEMBER_DIRS.find(
          (candidate) => String(readJson(path.join(candidate, "package.json")).name) === name,
        );
        const pkg = readJson(path.join(dir as string, "package.json"));
        return pkg.private !== true;
      });
      expect(publicNames).toEqual(["tailwind-canonicalize"]);
    });

    it("does not describe semantic-release or separately published internals in contributing/CI/architecture", () => {
      for (const rel of [
        "docs/guides/contributing.md",
        "docs/guides/ci.md",
        "docs/architecture/overview.md",
      ]) {
        const text = readText(rel);
        expect(text).not.toMatch(/semantic-release/);
        expect(text).not.toMatch(/separately published/);
      }
    });
  });
});
