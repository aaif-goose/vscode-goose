import { useState } from 'react';
import { MessageStatus } from '../../../shared/types';
import { MarkdownRenderer } from '../markdown/MarkdownRenderer';
import { CopyButton } from '../markdown/CopyButton';
import { ProgressIndicator } from './ProgressIndicator';

const MAX_LINES_COLLAPSED = 15;

interface AssistantMessageProps {
  content: string;
  timestamp?: Date;
  status: MessageStatus;
  isStreaming: boolean;
}

function formatTime(date?: Date): string {
  if (!date) return 'Earlier';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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

export function AssistantMessage({
  content,
  timestamp,
  status,
  isStreaming,
}: AssistantMessageProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const showIndicator = isStreaming && !content;

  // Only truncate history messages (no timestamp) that aren't streaming
  const isHistoryMessage = !timestamp;
  const { truncated, isTruncated, totalLines } = truncateContent(content, MAX_LINES_COLLAPSED);
  const displayContent = isHistoryMessage && isTruncated && !isExpanded && !isStreaming ? truncated : content;

  return (
    <div className="flex flex-col items-start group">
      <div className="w-full">
        <div className="relative">
          {showIndicator ? (
            <ProgressIndicator className="py-2" />
          ) : (
            <>
              <MarkdownRenderer content={displayContent} isStreaming={isStreaming} />
              {isHistoryMessage && isTruncated && !isStreaming && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="mt-2 text-xs text-[var(--vscode-textLink-foreground)] hover:underline"
                >
                  {isExpanded ? 'Show less' : `Show more (${totalLines} lines)`}
                </button>
              )}
            </>
          )}
          {!isStreaming && content && (
            <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <CopyButton text={content} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <p className={`text-xs text-[var(--vscode-descriptionForeground)] ${!timestamp ? 'italic' : ''}`}>
            {formatTime(timestamp)}
          </p>
          {status === MessageStatus.CANCELLED && (
            <span className="text-xs text-[var(--vscode-descriptionForeground)] italic">
              (cancelled)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
