import { useState } from 'react';
import { getLanguageFromPath, parseContent } from '../../../shared/fileReferenceParser';
import { MessageContext } from '../../../shared/types';
import { FileTypeIcon } from '../icons/FileTypeIcon';
import { MarkdownRenderer } from '../markdown/MarkdownRenderer';
import { FileReferenceCard } from './FileReferenceCard';

const MAX_LINES_COLLAPSED = 15;

interface UserMessageProps {
  content: string;
  timestamp?: Date;
  context?: readonly MessageContext[];
}

function formatTime(date?: Date): string {
  if (!date) return 'Earlier';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatContextLabel(ctx: MessageContext): string {
  if (ctx.range) {
    return `${ctx.fileName}:${ctx.range.startLine}-${ctx.range.endLine}`;
  }
  return ctx.fileName;
}

function truncateContent(
  content: string,
  maxLines: number
): { truncated: string; isTruncated: boolean; totalLines: number } {
  const lines = content.split('\n');
  if (lines.length <= maxLines) {
    return { truncated: content, isTruncated: false, totalLines: lines.length };
  }
  return {
    truncated: lines.slice(0, maxLines).join('\n') + '\n...',
    isTruncated: true,
    totalLines: lines.length,
  };
}

export function UserMessage({ content, timestamp, context }: UserMessageProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasTextContent = content.trim().length > 0;
  const hasContext = context && context.length > 0;

  // Check if content is a file reference (from history)
  const parsedContent = parseContent(content);
  const isFileReference = parsedContent.type === 'file_reference';

  // Only truncate history messages (no timestamp) that aren't file references
  const isHistoryMessage = !timestamp;
  const { truncated, isTruncated, totalLines } = truncateContent(content, MAX_LINES_COLLAPSED);
  const displayContent =
    isHistoryMessage && isTruncated && !isExpanded && !isFileReference ? truncated : content;

  return (
    <div className="flex flex-col items-end">
      <div className="ml-auto max-w-[80%]">
        {/* Context badges - same UI for input and history */}
        {hasContext && (
          <div className="flex flex-wrap gap-1 justify-end mb-1">
            {context.map((ctx, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]"
                title={ctx.filePath}
              >
                <FileTypeIcon
                  languageId={getLanguageFromPath(ctx.filePath)}
                  className="w-3 h-3 flex-shrink-0"
                />
                {formatContextLabel(ctx)}
              </span>
            ))}
          </div>
        )}

        {/* File reference content */}
        {isFileReference && parsedContent.type === 'file_reference' ? (
          <FileReferenceCard reference={parsedContent.reference} />
        ) : hasTextContent ? (
          /* Text content */
          <div className="bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded-2xl px-4 py-2">
            <MarkdownRenderer content={displayContent} variant="bubble" />
            {isHistoryMessage && isTruncated && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-2 text-xs opacity-70 hover:opacity-100 underline"
              >
                {isExpanded ? 'Show less' : `Show more (${totalLines} lines)`}
              </button>
            )}
          </div>
        ) : null}

        <p
          className={`text-xs text-[var(--vscode-descriptionForeground)] mt-1 text-right ${!timestamp ? 'italic' : ''}`}
        >
          {formatTime(timestamp)}
        </p>
      </div>
    </div>
  );
}
