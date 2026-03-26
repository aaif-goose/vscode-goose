import { parseContent } from '../../../shared/fileReferenceParser';
import { MessageStatus } from '../../../shared/types';
import { CopyButton } from '../markdown/CopyButton';
import { MarkdownRenderer } from '../markdown/MarkdownRenderer';
import { FileReferenceCard } from './FileReferenceCard';
import { ProgressIndicator } from './ProgressIndicator';

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

export function AssistantMessage({
  content,
  timestamp,
  status,
  isStreaming,
}: AssistantMessageProps) {
  const showIndicator = isStreaming && !content;

  // Parse content to check if it's a file reference
  // Only parse when not streaming to avoid partial matches
  const parsedContent = !isStreaming ? parseContent(content) : { type: 'text' as const, content };
  const isFileReference = parsedContent.type === 'file_reference';

  // Get copy text - for file references, use the file content if available
  const copyText =
    isFileReference && parsedContent.type === 'file_reference'
      ? parsedContent.reference.content || content
      : content;
  const renderInlineTimestamp = !showIndicator && !isFileReference;

  return (
    <div className="group flex flex-col items-start">
      <div className="w-full">
        <div className="relative">
          {showIndicator ? (
            <ProgressIndicator className="py-2" />
          ) : isFileReference && parsedContent.type === 'file_reference' ? (
            <FileReferenceCard reference={parsedContent.reference} />
          ) : (
            <div className="w-full rounded-xl px-3 pt-2 pb-6">
              <MarkdownRenderer content={content} isStreaming={isStreaming} />
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
            </div>
          )}
          {!isStreaming && content && (
            <div className="absolute -top-3 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
          </div>
        )}
      </div>
    </div>
  );
}
