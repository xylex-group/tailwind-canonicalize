export { extractClassOccurrences } from "./extract.js";
export { extractFromHtml, extractFromSfc } from "./html-extract.js";
export { extractFromJavaScript } from "./js-extract.js";
export type {
  ClassOccurrence,
  ExtractError,
  ExtractOptions,
  ExtractResult,
  SupportedExtension,
} from "./types.js";
export {
  defaultClassFunctions,
  defaultTaggedTemplates,
  extensionOf,
  isJsLike,
  isSupportedExtension,
  rebuildClassString,
  tokenizeClasses,
} from "./utils.js";
