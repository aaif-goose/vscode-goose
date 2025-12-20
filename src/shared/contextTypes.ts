/**
 * Context types for editor selection and file reference features.
 * Used for sending code context to the Goose agent via chips.
 */

/** Line range within a file */
export interface LineRange {
  readonly startLine: number;
  readonly endLine: number;
}

/** Context chip representing a file or selection reference */
export interface ContextChip {
  readonly id: string;
  readonly filePath: string;
  readonly fileName: string;
  readonly languageId: string;
  readonly range?: LineRange;
}

/** File search result for @ picker */
export interface FileSearchResult {
  readonly path: string;
  readonly fileName: string;
  readonly relativePath: string;
  readonly languageId: string;
  readonly recentScore: number;
}
