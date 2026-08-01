import { defineConfig } from "blume";

export default defineConfig({
  analytics: {
    vercel: true,
  },

  content: {
    sources: [
      {
        prefix: "docs",
        root: "docs",
        type: "filesystem",
      },
      {
        owner: "xylex-group",
        prefix: "changelog",
        repo: "tailwind-canonicalize",
        type: "github-releases",
      },
    ],
  },

  deployment: {
    adapter: "cloudflare",
    site: "https://tailwind-canonicalize.xbp.app",
  },

  description:
    "Semantic canonicalizer for Tailwind CSS — rewrite utilities only when provably equivalent.",

  github: {
    dir: "apps/docs",
    owner: "xylex-group",
    repo: "tailwind-canonicalize",
  },

  logo: {
    image: "/logo.svg",
    text: "tailwind-canonicalize",
  },

  navigation: {
    tabs: [
      {
        label: "Docs",
        path: "/docs",
      },
      {
        label: "Changelog",
        path: "/changelog",
      },
    ],
  },

  theme: {
    accent: "cyan",
  },

  title: "tailwind-canonicalize",
});
