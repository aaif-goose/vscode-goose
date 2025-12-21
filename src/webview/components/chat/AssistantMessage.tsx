import { useState } from 'react';
import { parseContent } from '../../../shared/fileReferenceParser';
import { MessageStatus } from '../../../shared/types';
import { CopyButton } from '../markdown/CopyButton';
import { MarkdownRenderer } from '../markdown/MarkdownRenderer';
import { FileReferenceCard } from './FileReferenceCard';
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

export function AssistantMessage({
  content,
  timestamp,
  status,
  isStreaming,
}: AssistantMessageProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const showIndicator = isStreaming && !content;

  // Parse content to check if it's a file reference
  // Only parse when not streaming to avoid partial matches
  const parsedContent = !isStreaming ? parseContent(content) : { type: 'text' as const, content };
  const isFileReference = parsedContent.type === 'file_reference';

  // Only truncate history messages (no timestamp) that aren't streaming and aren't file references
  const isHistoryMessage = !timestamp;
  const { truncated, isTruncated, totalLines } = truncateContent(content, MAX_LINES_COLLAPSED);
  const displayContent =
    isHistoryMessage && isTruncated && !isExpanded && !isStreaming && !isFileReference
      ? truncated
      : content;

  // Get copy text - for file references, use the file content if available
  const copyText =
    isFileReference && parsedContent.type === 'file_reference'
      ? parsedContent.reference.content || content
      : content;

  return (
    <div className="flex flex-col items-start group">
      <div className="w-full">
        <div className="relative">
          {showIndicator ? (
            <ProgressIndicator className="py-2" />
          ) : isFileReference && parsedContent.type === 'file_reference' ? (
            <FileReferenceCard reference={parsedContent.reference} />
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
              <CopyButton text={copyText} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <p
            className={`text-xs text-[var(--vscode-descriptionForeground)] ${!timestamp ? 'italic' : ''}`}
          >
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
