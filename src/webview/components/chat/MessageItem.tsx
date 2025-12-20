import { ChatMessage, MessageRole } from '../../../shared/types';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';
import { ErrorMessage } from './ErrorMessage';

interface MessageItemProps {
  message: ChatMessage;
  isFocused: boolean;
  isStreaming: boolean;
  onFocus: () => void;
  onRetry?: (content: string) => void;
}

export function MessageItem({
  message,
  isFocused,
  isStreaming,
  onFocus,
  onRetry,
}: MessageItemProps) {
  const focusClasses = isFocused
    ? 'ring-2 ring-[var(--vscode-focusBorder)] ring-offset-2 ring-offset-[var(--vscode-editor-background)]'
    : '';

  if (message.role === MessageRole.USER) {
    const timeLabel = message.timestamp
      ? ` at ${message.timestamp.toLocaleTimeString()}`
      : '';
    return (
      <div
        className={`${focusClasses} rounded-lg`}
        onClick={onFocus}
        role="article"
        aria-label={`User message${timeLabel}`}
      >
        <UserMessage content={message.content} timestamp={message.timestamp} />
      </div>
    );
  }

  if (message.role === MessageRole.ASSISTANT) {
    const timeLabel = message.timestamp
      ? ` at ${message.timestamp.toLocaleTimeString()}`
      : '';
    return (
      <div
        className={`${focusClasses} rounded-lg`}
        onClick={onFocus}
        role="article"
        aria-label={`Assistant message${timeLabel}`}
      >
        <AssistantMessage
          content={message.content}
          timestamp={message.timestamp}
          status={message.status}
          isStreaming={isStreaming}
        />
      </div>
    );
  }

  if (message.role === MessageRole.ERROR) {
    return (
      <div
        className={`${focusClasses} rounded-lg`}
        onClick={onFocus}
        role="alert"
        aria-label="Error message"
      >
        <ErrorMessage
          content={message.content}
          timestamp={message.timestamp}
          onRetry={onRetry}
          originalContent={message.originalContent}
        />
      </div>
    );
  }

  return null;
}
