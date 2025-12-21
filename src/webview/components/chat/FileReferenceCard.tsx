/**
 * File reference card component for displaying file content from Goose.
 * Renders as a collapsible chip - click to expand and see file content.
 */

import { useState } from 'react';
import type { ParsedFileReference } from '../../../shared/fileReferenceParser';
import { getLanguageFromPath } from '../../../shared/fileReferenceParser';
import { FileTypeIcon } from '../icons/FileTypeIcon';
import { CodeBlock } from '../markdown/CodeBlock';

interface FileReferenceCardProps {
  reference: ParsedFileReference;
}

/**
 * Displays a file reference as a collapsible chip.
 * Click to expand and see file content.
 */
export function FileReferenceCard({ reference }: FileReferenceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { filePath, fileName, content, language } = reference;
  const languageId = language || getLanguageFromPath(filePath);
  const hasContent = content && content.trim().length > 0;

  return (
    <div className="max-w-full overflow-hidden">
      {/* Collapsible file chip */}
      <button
        type="button"
        onClick={() => hasContent && setIsExpanded(!isExpanded)}
        className={`
          inline-flex items-center gap-2 px-3 py-1.5 rounded-lg
          bg-[var(--vscode-badge-background)]
          text-[var(--vscode-badge-foreground)]
          text-sm text-left
          max-w-full
          transition-colors
          ${hasContent ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
        `}
        title={filePath}
        aria-expanded={isExpanded}
      >
        {/* Expand/collapse indicator */}
        {hasContent && (
          <ChevronIcon expanded={isExpanded} className="w-3 h-3 flex-shrink-0 opacity-70" />
        )}
        <FileTypeIcon languageId={languageId} className="w-4 h-4 flex-shrink-0" />
        <span className="font-medium truncate">
          {fileName}
          {reference.lineRange && (
            <span className="opacity-70">
              :{reference.lineRange.startLine}-{reference.lineRange.endLine}
            </span>
          )}
        </span>
        {/* Show directory path only when collapsed */}
        {!isExpanded && (
          <span className="text-xs opacity-70 truncate min-w-0">{getDirectoryPath(filePath)}</span>
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-2 space-y-2">
          {/* Full file path - selectable */}
          <div
            className="
              text-xs text-[var(--vscode-descriptionForeground)]
              font-mono px-1 py-0.5
              select-all cursor-text
              break-all
            "
            title="Click to select path"
          >
            {filePath}
          </div>
          {/* Code content */}
          {hasContent && (
            <div className="overflow-x-auto">
              <CodeBlock code={content} language={languageId} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ expanded, className }: { expanded: boolean; className?: string }) {
  return (
    <svg
      className={`${className} transition-transform ${expanded ? 'rotate-90' : ''}`}
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M6 4l4 4-4 4V4z" />
    </svg>
  );
}

/**
 * Extracts the directory path from a full file path.
 */
function getDirectoryPath(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  parts.pop(); // Remove filename
  const dir = parts.join('/');

  // Shorten long paths
  if (dir.length > 40) {
    return '...' + dir.slice(-37);
  }
  return dir;
}
