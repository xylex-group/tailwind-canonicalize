# tailwind-canonicalize

[![npm](https://img.shields.io/npm/v/tailwind-canonicalize.svg)](https://www.npmjs.com/package/tailwind-canonicalize)

Semantic canonicalizer for Tailwind CSS utility classes — rewrite arbitrary values to theme tokens **only when provably identical**.

| | |
|--|--|
| **Homepage** | [https://tailwind-canonicalize.xbp.app](https://tailwind-canonicalize.xbp.app) |
| **npm** | [tailwind-canonicalize](https://www.npmjs.com/package/tailwind-canonicalize) |
| **Version** | `0.1.2` |
| **Repository** | [xylex-group/tailwind-canonicalize](https://github.com/xylex-group/tailwind-canonicalize) |

## Install

```bash
npm i -D tailwind-canonicalize
```

Node **20+**. ESM only.

## CLI

```bash
npx tailwind-canonicalize .
npx tailwind-canonicalize . --write --safe
npx tailwind-canonicalize . --check
```

## Library

```ts
import { canonicalizeClass, canonicalizeProject } from "tailwind-canonicalize";

canonicalizeClass("w-[40px]"); // "w-10"
```

Full documentation: **[https://tailwind-canonicalize.xbp.app](https://tailwind-canonicalize.xbp.app)**

## License

MIT © XYLEX Group
