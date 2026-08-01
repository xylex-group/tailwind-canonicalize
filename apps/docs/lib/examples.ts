/** Interactive homepage + docs examples for tailwind-canonicalize. */

export interface CodeExample {
  id: string;
  title: string;
  description: string;
  before: string;
  after: string;
  lang: "tsx" | "html" | "bash" | "css" | "json";
  category: "canonical" | "migration" | "tokens" | "safety";
}

export const examples: CodeExample[] = [
  {
    id: "spacing",
    title: "Arbitrary spacing → theme scale",
    description:
      "Only when the active theme proves the values are identical (default spacing unit 0.25rem).",
    category: "canonical",
    lang: "tsx",
    before: `<div
  className="
    w-[40px]
    min-w-[10rem]
    h-[10px]
    p-[16px]
    gap-[8px]
  "
/>`,
    after: `<div
  className="
    w-10
    min-w-40
    h-2.5
    p-4
    gap-2
  "
/>`,
  },
  {
    id: "variants",
    title: "Variants & important preserved",
    description: "hover:, dark:, md:, and ! never get stripped.",
    category: "canonical",
    lang: "tsx",
    before: `<div className="hover:md:w-[40px] dark:p-[16px] max-w-[160px]!" />`,
    after: `<div className="hover:md:w-10 dark:p-4 max-w-40!" />`,
  },
  {
    id: "keywords",
    title: "Keywords & fractions",
    description: "Exact CSS keywords and percentage fractions.",
    category: "canonical",
    lang: "tsx",
    before: `<div className="w-[100%] h-[100vh] max-w-[50%] w-[fit-content]" />`,
    after: `<div className="w-full h-screen max-w-1/2 w-fit" />`,
  },
  {
    id: "gradient",
    title: "Tailwind v4 gradient migration",
    description: "Versioned registry renames — not string guessing.",
    category: "migration",
    lang: "tsx",
    before: `<div className="hover:bg-gradient-to-br dark:md:bg-gradient-to-t" />`,
    after: `<div className="hover:bg-linear-to-br dark:md:bg-linear-to-t" />`,
  },
  {
    id: "tokens",
    title: "Approved semantic tokens",
    description: "Only after tokens analyze + approved manifest. Never automatic.",
    category: "tokens",
    lang: "tsx",
    before: `<div className="bg-white text-slate-800 border-slate-200" />`,
    after: `<div className="bg-background text-foreground border-border" />`,
  },
  {
    id: "dark-pair",
    title: "Light + dark pair collapse",
    description: "When the semantic token defines both themes.",
    category: "tokens",
    lang: "tsx",
    before: `<div className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100" />`,
    after: `<div className="bg-background text-foreground" />`,
  },
  {
    id: "recipe",
    title: "Warning surface recipe",
    description: "Co-occurring colors map as a coherent set.",
    category: "tokens",
    lang: "tsx",
    before: `function WarningAlert() {
  return (
    <div className="border-amber-200 bg-amber-200 text-slate-800">
      Warning
    </div>
  );
}`,
    after: `function WarningAlert() {
  return (
    <div className="border-warning-subtle bg-warning-subtle text-warning-foreground">
      Warning
    </div>
  );
}`,
  },
  {
    id: "safety",
    title: "Never rewritten (safety)",
    description: "calc, var, unknown values, and arbitrary properties stay put.",
    category: "safety",
    lang: "tsx",
    before: `<div
  className="
    w-[13px]
    w-[calc(100%-1rem)]
    w-[var(--sidebar)]
    [mask-image:url(/a.png)]
  "
/>`,
    after: `<div
  className="
    w-[13px]
    w-[calc(100%-1rem)]
    w-[var(--sidebar)]
    [mask-image:url(/a.png)]
  "
/>`,
  },
  {
    id: "clsx",
    title: "clsx / cn / cva",
    description: "Real AST extraction — nested calls, objects, conditionals.",
    category: "canonical",
    lang: "tsx",
    before: `cn(
  "w-[40px] p-[16px]",
  cond && "h-[10px]",
  { "gap-[8px]": ok },
)`,
    after: `cn(
  "w-10 p-4",
  cond && "h-2.5",
  { "gap-2": ok },
)`,
  },
];

export const cliSnippets = {
  install: "pnpm add -D tailwind-canonicalize",
  write: "pnpm exec tailwind-canonicalize . --write --safe",
  check: "pnpm exec tailwind-canonicalize . --check --json",
  migrate:
    "pnpm exec tailwind-canonicalize . --migrate --from-tailwind 3 --to-tailwind 4 --write",
  tokensAnalyze:
    "pnpm exec tailwind-canonicalize tokens analyze . --out proposed.json",
  tokensApply:
    "pnpm exec tailwind-canonicalize tokens apply tailwind-tokens.json --write",
  watch: "pnpm exec tailwind-canonicalize . --watch --write",
};

export const configExample = `import { defineConfig } from "tailwind-canonicalize";

export default defineConfig({
  tailwind: {
    version: 4,
    stylesheet: "./src/styles/globals.css",
  },
  canonicalize: {
    arbitraryValues: true,
    deprecatedClasses: true,
    duplicateClasses: true,
  },
  tokens: {
    enabled: true,
    mode: "approved-only",
    manifest: "./tailwind-tokens.json",
  },
  migrations: {
    gradients: true,
    tailwindV4: true,
  },
});`;

export const lintStagedExample = `{
  "*.{js,jsx,ts,tsx,vue,astro,html,mdx}": [
    "tailwind-canonicalize --write",
    "biome check --write --no-errors-on-unmatched"
  ]
}`;
