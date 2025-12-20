import { useState } from 'react';
import { MarkdownRenderer } from '../markdown/MarkdownRenderer';
import { MessageContext } from '../../../shared/types';

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

function truncateContent(content: string, maxLines: number): { truncated: string; isTruncated: boolean; totalLines: number } {
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

  // Only truncate history messages (no timestamp)
  const isHistoryMessage = !timestamp;
  const { truncated, isTruncated, totalLines } = truncateContent(content, MAX_LINES_COLLAPSED);
  const displayContent = isHistoryMessage && isTruncated && !isExpanded ? truncated : content;

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
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="opacity-70">
                  <path d="M13.5 1H3.5L2 2.5v11l1.5 1.5h10l1.5-1.5v-11L13.5 1zM13 13H4V3h9v10z" />
                </svg>
                {formatContextLabel(ctx)}
              </span>
            ))}
          </div>
        )}

        {/* Text content */}
        {hasTextContent && (
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
        )}

        <p className={`text-xs text-[var(--vscode-descriptionForeground)] mt-1 text-right ${!timestamp ? 'italic' : ''}`}>
          {formatTime(timestamp)}
        </p>
      </div>
    </div>
  );
}
