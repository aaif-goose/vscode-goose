import { MessageStatus } from '../../../shared/types';
import { MarkdownRenderer } from '../markdown/MarkdownRenderer';
import { CopyButton } from '../markdown/CopyButton';
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

  return (
    <div className="flex flex-col items-start group">
      <div className="w-full">
        <div className="relative">
          {showIndicator ? (
            <ProgressIndicator className="py-2" />
          ) : (
            <MarkdownRenderer content={content} isStreaming={isStreaming} />
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
