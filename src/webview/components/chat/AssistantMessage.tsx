import { parseContent } from '../../../shared/fileReferenceParser';
import { ChatContentPart, MessageStatus } from '../../../shared/types';
import { CopyButton } from '../markdown/CopyButton';
import { MarkdownRenderer } from '../markdown/MarkdownRenderer';
import { FileReferenceCard } from './FileReferenceCard';
import { ProgressIndicator } from './ProgressIndicator';
import { ThinkingBlock } from './ThinkingBlock';
import { ToolCallCard } from './ToolCallCard';

interface AssistantMessageProps {
  content: string;
  contentParts?: readonly ChatContentPart[];
  timestamp?: Date;
  status: MessageStatus;
  isStreaming: boolean;
  errorDetails?: string;
}

function formatTime(date?: Date): string {
  if (!date) return 'Earlier';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function getCopyText(content: string, contentParts?: readonly ChatContentPart[]): string {
  if (!contentParts || contentParts.length === 0) return content;
  return contentParts
    .map(part => {
      if (part.type === 'text') return part.text;
      return '';
    })
    .join('');
}

export function AssistantMessage({
  content,
  contentParts,
  timestamp,
  status,
  isStreaming,
  errorDetails,
}: AssistantMessageProps) {
  const hasStructuredParts = Boolean(contentParts && contentParts.length > 0);
  const showIndicator = isStreaming && !hasStructuredParts && !content;

  // Only parse plain assistant content when we're not rendering structured parts.
  const parsedContent =
    !isStreaming && !hasStructuredParts
      ? parseContent(content)
      : ({ type: 'text', content } as const);
  const isFileReference = parsedContent.type === 'file_reference';

  const copyText = hasStructuredParts
    ? getCopyText(content, contentParts)
    : isFileReference && parsedContent.type === 'file_reference'
      ? parsedContent.reference.content || content
      : content;
  const renderInlineTimestamp = !showIndicator && (!isFileReference || hasStructuredParts);
  const hasErrorDetails = status === MessageStatus.ERROR && !!errorDetails;

  return (
    <div className="group flex flex-col items-start">
      <div className="w-full">
        <div className="relative">
          {showIndicator ? (
            <ProgressIndicator className="py-2" />
          ) : hasStructuredParts ? (
            <div className="flex flex-col gap-3 rounded-xl px-3 pt-2 pb-6">
              {contentParts.map((part, index) => {
                if (part.type === 'text') {
                  return (
                    <div key={`${part.type}-${index}`} className="w-full">
                      <MarkdownRenderer content={part.text} isStreaming={Boolean(part.streaming)} />
                    </div>
                  );
                }

                if (part.type === 'thinking') {
                  return <ThinkingBlock key={`${part.type}-${index}`} part={part} />;
                }

                if (part.type === 'tool_call') {
                  return <ToolCallCard key={part.id} part={part} />;
                }

                return null;
              })}
            </div>
          ) : isFileReference && parsedContent.type === 'file_reference' ? (
            <FileReferenceCard reference={parsedContent.reference} />
          ) : (
            <div className="w-full rounded-xl px-3 pt-2 pb-6">
              <MarkdownRenderer content={content} isStreaming={isStreaming} />
              {hasErrorDetails && (
                <details className="mt-3 rounded-lg border border-[var(--vscode-inputValidation-errorBorder,var(--vscode-errorForeground))] bg-[var(--vscode-inputValidation-errorBackground,rgba(255,0,0,0.08))] px-3 py-2">
                  <summary className="cursor-pointer text-sm text-[var(--vscode-errorForeground)]">
                    Error details
                  </summary>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-[var(--vscode-errorForeground)]">
                    {errorDetails}
                  </pre>
                </details>
              )}
            </div>
          )}

          {renderInlineTimestamp && (
            <div className="absolute inset-x-0 bottom-0 flex h-6 items-center gap-2 pl-3">
              <p
                className={`text-[11px] text-[var(--vscode-descriptionForeground)] ${!timestamp ? 'italic' : ''}`}
              >
                {formatTime(timestamp)}
              </p>
              {status === MessageStatus.CANCELLED && (
                <span className="text-[11px] text-[var(--vscode-descriptionForeground)] italic">
                  (cancelled)
                </span>
              )}
              {status === MessageStatus.ERROR && (
                <span className="text-[11px] text-[var(--vscode-errorForeground)] italic">
                  (error)
                </span>
              )}
            </div>
          )}

          {!isStreaming && copyText && (
            <div className="absolute -top-3 right-2 opacity-0 transition-opacity group-hover:opacity-100">
              <CopyButton text={copyText} />
            </div>
          )}
        </div>
        {!renderInlineTimestamp && (
          <div className="mt-1 flex items-center gap-2">
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
            {status === MessageStatus.ERROR && (
              <span className="text-xs text-[var(--vscode-errorForeground)] italic">(error)</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
