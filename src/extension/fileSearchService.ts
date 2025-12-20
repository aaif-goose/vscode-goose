/**
 * File search service for @ file picker.
 * Uses VS Code workspace APIs to find files with fuzzy matching.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from './logger';
import { FileSearchResult } from '../shared/contextTypes';

/** Service for searching workspace files */
export interface FileSearchService {
  readonly search: (query: string) => Promise<readonly FileSearchResult[]>;
  readonly dispose: () => void;
}

/** Map file extension to VS Code language identifier */
function getLanguageId(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const extensionMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescriptreact',
    '.js': 'javascript',
    '.jsx': 'javascriptreact',
    '.py': 'python',
    '.rs': 'rust',
    '.go': 'go',
    '.java': 'java',
    '.cs': 'csharp',
    '.cpp': 'cpp',
    '.cc': 'cpp',
    '.cxx': 'cpp',
    '.c': 'c',
    '.h': 'c',
    '.hpp': 'cpp',
    '.html': 'html',
    '.htm': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'scss',
    '.less': 'less',
    '.json': 'json',
    '.md': 'markdown',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.xml': 'xml',
    '.sql': 'sql',
    '.sh': 'shell',
    '.bash': 'bash',
    '.zsh': 'shell',
    '.ps1': 'powershell',
    '.rb': 'ruby',
    '.php': 'php',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.kts': 'kotlin',
    '.scala': 'scala',
    '.vue': 'vue',
    '.svelte': 'svelte',
  };

  return extensionMap[ext] ?? 'plaintext';
}

/**
 * Create a file search service for workspace file discovery.
 * Tracks recently opened files for sorting results.
 */
export function createFileSearchService(logger: Logger): FileSearchService {
  const recentFiles: Map<string, number> = new Map();

  // Track recently opened files
  const disposable = vscode.workspace.onDidOpenTextDocument(doc => {
    // Only track workspace files (not untitled, git, etc.)
    if (doc.uri.scheme === 'file') {
      recentFiles.set(doc.uri.fsPath, Date.now());
    }
  });

  async function search(query: string): Promise<readonly FileSearchResult[]> {
    const exclude = '{**/node_modules/**,**/.git/**}';
    const lowerQuery = query.toLowerCase();

    logger.debug(`Searching files with query: ${query}`);

    // Get all files (or broad pattern match), then filter case-insensitively
    // Using ** /* to get more files when query is provided, since glob is case-sensitive
    const pattern = '**/*';
    const maxResults = query ? 1000 : 20; // Get more candidates when filtering

    const uris = await vscode.workspace.findFiles(pattern, exclude, maxResults);

    let results: FileSearchResult[] = uris.map(uri => ({
      path: uri.fsPath,
      fileName: path.basename(uri.fsPath),
      languageId: getLanguageId(uri.fsPath),
      recentScore: recentFiles.get(uri.fsPath) ?? 0,
    }));

    // Filter case-insensitively if query is provided
    if (query) {
      results = results.filter(r => r.fileName.toLowerCase().includes(lowerQuery));
    }

    // Sort by recent score descending (most recently opened first)
    results.sort((a, b) => b.recentScore - a.recentScore);

    // Limit to 20 results
    results = results.slice(0, 20);

    logger.debug(`Found ${results.length} files for query: ${query}`);

    return results;
  }

  function dispose(): void {
    disposable.dispose();
    recentFiles.clear();
    logger.debug('FileSearchService disposed');
  }

  return { search, dispose };
}
