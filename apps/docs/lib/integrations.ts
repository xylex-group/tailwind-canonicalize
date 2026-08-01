export type IntegrationId = "biome" | "eslint" | "oxlint" | "prettier";

export interface Integration {
  id: IntegrationId;
  name: string;
  role: string;
  href: string;
  snippet: string;
}

export const integrations: Integration[] = [
  {
    id: "biome",
    name: "Biome",
    role: "Format + lint",
    href: "/docs/integrations/biome",
    snippet: `// package.json
{
  "scripts": {
    "fix": "tailwind-canonicalize . --write --safe && biome check --write .",
    "check": "tailwind-canonicalize . --check && biome ci ."
  }
}`,
  },
  {
    id: "eslint",
    name: "ESLint",
    role: "Lint rules",
    href: "/docs/integrations/eslint",
    snippet: `{
  "scripts": {
    "fix": "tailwind-canonicalize . --write --safe && eslint . --fix",
    "check": "tailwind-canonicalize . --check && eslint ."
  }
}`,
  },
  {
    id: "oxlint",
    name: "Oxlint",
    role: "Fast lint",
    href: "/docs/integrations/oxlint",
    snippet: `{
  "scripts": {
    "check": "tailwind-canonicalize . --check && oxlint ."
  }
}`,
  },
  {
    id: "prettier",
    name: "Prettier",
    role: "Format only",
    href: "/docs/integrations/prettier",
    snippet: `{
  "*.{js,jsx,ts,tsx}": [
    "tailwind-canonicalize --write",
    "prettier --write"
  ]
}`,
  },
];
