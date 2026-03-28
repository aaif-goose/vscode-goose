import { ChatContentPart, MessageStatus } from '../../../shared/types';
import { CopyButton } from '../markdown/CopyButton';
import { MarkdownRenderer } from '../markdown/MarkdownRenderer';
import { ProgressIndicator } from './ProgressIndicator';
import { ThinkingBlock } from './ThinkingBlock';
import { ToolCallCard } from './ToolCallCard';

interface AssistantMessageProps {
  content: string;
  contentParts?: readonly ChatContentPart[];
  timestamp?: Date;
  status: MessageStatus;
  isStreaming: boolean;
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
      if (part.type === 'thinking') return '';
      if (part.type === 'tool_call') return '';
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
}: AssistantMessageProps) {
  const showIndicator = isStreaming && (!contentParts || contentParts.length === 0) && !content;
  const renderInlineTimestamp = !showIndicator;
  const copyText = getCopyText(content, contentParts);

  return (
    <div className="group flex flex-col items-start">
      <div className="w-full">
        <div className="relative">
          {showIndicator ? (
            <ProgressIndicator className="py-2" />
          ) : contentParts && contentParts.length > 0 ? (
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

          {!isStreaming && copyText && (
            <div className="absolute -top-3 right-2 opacity-0 transition-opacity group-hover:opacity-100">
              <CopyButton text={copyText} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
