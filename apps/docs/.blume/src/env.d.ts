/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare module "blume:ask" {
  const Ask: typeof import("blume/components/islands/AskAI.astro").default;
  export default Ask;
}

declare module "blume:data" {
  const data: import("blume").BlumeData;
  export default data;
}

declare module "blume:examples" {
  type Examples = typeof import("./generated/examples.ts").examples;
  export const examples: Record<string, Examples[keyof Examples]>;
  export const examplesBase: string;
}

declare module "blume:examples-theme";

declare module "blume:openapi" {
  const specs: import("blume/openapi/model.ts").OpenApiData;
  export default specs;
}

declare module "blume:search-client" {
  export const createSearch: () =>
    | import("blume/components/layout/search/types.ts").SearchFn
    | Promise<import("blume/components/layout/search/types.ts").SearchFn>;
}
