import type { ClassOccurrence } from "@tailwind-canonicalize/parser";
import type {
  ClassStringDiagnostic,
  PipelineOptions,
  TransformationRecord,
} from "@tailwind-canonicalize/resolver";

export interface Rewrite {
  from: string;
  to: string;
  start: number;
  end: number;
  occurrence: ClassOccurrence;
  transformations: TransformationRecord[];
}

export interface TransformResult {
  original: string;
  code: string;
  changed: boolean;
  rewrites: Rewrite[];
  transformations: TransformationRecord[];
  diagnostics: ClassStringDiagnostic[];
  map: { mappings: string; names: string[]; sources: string[]; file?: string } | null;
}

export interface TransformOptions extends PipelineOptions {
  filePath?: string;
  sourceMap?: boolean;
  dryRun?: boolean;
}
