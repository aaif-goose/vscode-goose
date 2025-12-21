/**
 * Parser for detecting and extracting file references from markdown content.
 * Handles the pattern where Goose sends file content as:
 *
 * # /path/to/file.ext
 * ```language
 * file content
 * ```
 */

/** Parsed file reference from markdown content */
export interface ParsedFileReference {
  /** Absolute file path */
  readonly filePath: string;
  /** File name extracted from path */
  readonly fileName: string;
  /** Optional file content from code block */
  readonly content?: string;
  /** Optional language hint from code fence */
  readonly language?: string;
  /** Optional line range (for selections) */
  readonly lineRange?: {
    readonly startLine: number;
    readonly endLine: number;
  };
}

/** Result of parsing content - either a file reference or regular content */
export type ParseResult =
  | { readonly type: 'file_reference'; readonly reference: ParsedFileReference }
  | { readonly type: 'text'; readonly content: string };

/**
 * Pattern to detect file reference format (H1 style):
 * - Starts with optional whitespace/newlines
 * - Then `# ` followed by an absolute path (starts with / or drive letter)
 * - Optionally followed by a code block (with optional language specifier)
 */
const H1_FILE_REFERENCE_PATTERN =
  /^\s*#\s+(\/[^\n]+|[A-Za-z]:\\[^\n]+)\s*(?:```(\w*)?\n([\s\S]*?)```\s*)?$/;

/**
 * Pattern to detect file reference format (File: style with line numbers):
 * - Starts with `File: ` followed by absolute path
 * - Optionally with line range `:startLine-endLine`
 * - Followed by a code block
 */
const FILE_PREFIX_PATTERN =
  /^\s*File:\s+(\/[^\n:]+|[A-Za-z]:\\[^\n:]+)(?::(\d+)-(\d+))?\s*(?:```(\w*)?\n([\s\S]*?)```\s*)?$/;

/**
 * Checks if content appears to be a file reference message from Goose.
 * This is a quick check before attempting full parsing.
 */
export function isFileReferenceContent(content: string): boolean {
  const trimmed = content.trim();
  // Check for H1 style: # /path
  if (/^#\s+(\/|[A-Za-z]:\\)/.test(trimmed)) {
    return true;
  }
  // Check for File: style
  if (/^File:\s+(\/|[A-Za-z]:\\)/.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * Parses content to extract file reference if present.
 * Returns null if content doesn't match the file reference pattern.
 * Handles two formats:
 * 1. H1 style: `# /path/to/file`
 * 2. File: style: `File: /path/to/file:startLine-endLine`
 */
export function parseFileReference(content: string): ParsedFileReference | null {
  const trimmed = content.trim();

  if (!isFileReferenceContent(trimmed)) {
    return null;
  }

  // Try H1 style first: # /path/to/file
  const h1Match = trimmed.match(H1_FILE_REFERENCE_PATTERN);
  if (h1Match) {
    const filePath = h1Match[1].trim();
    const language = h1Match[2] || undefined;
    const fileContent = h1Match[3]?.trim() || undefined;

    const pathParts = filePath.split(/[/\\]/);
    const fileName = pathParts[pathParts.length - 1] || filePath;

    return {
      filePath,
      fileName,
      content: fileContent,
      language,
    };
  }

  // Try File: style: File: /path/to/file:startLine-endLine
  const filePrefixMatch = trimmed.match(FILE_PREFIX_PATTERN);
  if (filePrefixMatch) {
    const filePath = filePrefixMatch[1].trim();
    const startLine = filePrefixMatch[2] ? parseInt(filePrefixMatch[2], 10) : undefined;
    const endLine = filePrefixMatch[3] ? parseInt(filePrefixMatch[3], 10) : undefined;
    const language = filePrefixMatch[4] || undefined;
    const fileContent = filePrefixMatch[5]?.trim() || undefined;

    const pathParts = filePath.split(/[/\\]/);
    const fileName = pathParts[pathParts.length - 1] || filePath;

    return {
      filePath,
      fileName,
      content: fileContent,
      language,
      lineRange:
        startLine !== undefined && endLine !== undefined ? { startLine, endLine } : undefined,
    };
  }

  return null;
}

/**
 * Parses content and returns a discriminated union result.
 * Use this when you need to handle both file references and regular text.
 */
export function parseContent(content: string): ParseResult {
  const reference = parseFileReference(content);

  if (reference) {
    return { type: 'file_reference', reference };
  }

  return { type: 'text', content };
}

/**
 * Gets language ID from file path for syntax highlighting.
 */
export function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const extensionMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescriptreact',
    js: 'javascript',
    jsx: 'javascriptreact',
    py: 'python',
    rs: 'rust',
    go: 'go',
    java: 'java',
    cs: 'csharp',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    hpp: 'cpp',
    html: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    md: 'markdown',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    sql: 'sql',
    sh: 'shell',
    bash: 'bash',
    ps1: 'powershell',
    rb: 'ruby',
    php: 'php',
    swift: 'swift',
  };

  return extensionMap[ext] ?? 'plaintext';
}
