/**
 * Internal transformation categories.
 * Kept separate: different safety guarantees, config, and review expectations.
 */
export type TransformationCategory =
  | "canonical-class"
  | "tailwind-migration"
  | "semantic-color-token"
  | "semantic-spacing-token"
  | "duplicate-token-removal"
  | "theme-normalization";

export type Confidence = "high" | "medium" | "low" | "exact";

export type SafetyLevel = "safe" | "review" | "aggressive";

/**
 * A single reported transformation (token-level or class-string-level).
 */
export interface TransformationRecord {
  category: TransformationCategory;
  original: string;
  replacement: string;
  /** Absolute file path when known. */
  file?: string;
  line?: number;
  column?: number;
  /** Associated design token (CSS variable), if any. */
  token?: string;
  confidence: Confidence;
  safety: SafetyLevel;
  /** Migration or mapping id. */
  id?: string;
  notes?: string;
}

export interface UtilityIdentity {
  /** Ordered variant segments without trailing colon, e.g. ["hover","md"]. */
  variants: string[];
  important: boolean;
  /** Property group used for conflict detection, e.g. "width", "background-color". */
  propertyGroup: string;
  /** Canonical value key for the group (scale suffix or full base). */
  value: string;
  /** Full normalized token for exact identity. */
  normalized: string;
}

export interface ClassStringDiagnostic {
  kind: "conflict" | "info" | "duplicate-candidate";
  message: string;
  utilities: string[];
}

export interface PipelineResult {
  result: string;
  transformations: TransformationRecord[];
  diagnostics: ClassStringDiagnostic[];
}
