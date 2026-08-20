import { pathToFileURL } from "node:url";
import type { PipelineMode, TokenMapping } from "@tailwind-canonicalize/resolver";

export interface TailwindCanonicalizeConfig {
  tailwind?: {
    version?: 3 | 4;
    stylesheet?: string;
  };
  canonicalize?: {
    arbitraryValues?: boolean;
    deprecatedClasses?: boolean;
    duplicateClasses?: boolean;
  };
  tokens?: {
    enabled?: boolean;
    mode?: "approved-only" | "propose" | "aggressive";
    manifest?: string;
    semanticFamilies?: string[];
    preserveSemanticAliases?: boolean;
    removeUnusedGeneratedTokens?: boolean;
  };
  migrations?: {
    gradients?: boolean;
    tailwindV4?: boolean;
    from?: number | string;
    to?: number | string;
  };
  mode?: PipelineMode;
  rootFontSizePx?: number;
  ignore?: string[];
  concurrency?: number;
}

export function defineConfig(config: TailwindCanonicalizeConfig): TailwindCanonicalizeConfig {
  return config;
}

/**
 * Load config from tailwind-canonicalize.config.{ts,js,mjs,cjs} or package field.
 */
export async function loadConfig(cwd: string): Promise<TailwindCanonicalizeConfig> {
  const candidates = [
    "tailwind-canonicalize.config.ts",
    "tailwind-canonicalize.config.mts",
    "tailwind-canonicalize.config.js",
    "tailwind-canonicalize.config.mjs",
    "tailwind-canonicalize.config.cjs",
  ];

  for (const name of candidates) {
    const full = `${cwd.replace(/\\/g, "/")}/${name}`;
    try {
      const href = pathToFileURL(full).href;
      const mod = await import(href);
      const cfg = (mod.default ?? mod) as TailwindCanonicalizeConfig;
      if (cfg && typeof cfg === "object") {
        return cfg;
      }
    } catch {
      // try next
    }
  }
  return {};
}

export function configToPipelineFlags(config: TailwindCanonicalizeConfig): {
  mode: PipelineMode;
  arbitraryValues: boolean;
  migrations: boolean;
  duplicateClasses: boolean;
  fromTailwind?: number | string;
  toTailwind?: number | string;
  tokenMappings?: TokenMapping[];
  manifestPath?: string;
  tokensEnabled: boolean;
} {
  return {
    mode: config.mode ?? "safe",
    arbitraryValues: config.canonicalize?.arbitraryValues !== false,
    migrations:
      config.canonicalize?.deprecatedClasses === true ||
      config.migrations?.tailwindV4 === true ||
      config.migrations?.gradients === true,
    duplicateClasses: config.canonicalize?.duplicateClasses !== false,
    fromTailwind: config.migrations?.from,
    toTailwind: config.migrations?.to ?? config.tailwind?.version,
    manifestPath: config.tokens?.manifest,
    tokensEnabled: config.tokens?.enabled === true,
  };
}
