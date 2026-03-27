import { memo } from 'react';
import { ChatMessage, MessageRole } from '../../../shared/types';
import { AssistantMessage } from './AssistantMessage';
import { ErrorMessage } from './ErrorMessage';
import { UserMessage } from './UserMessage';

interface MessageItemProps {
  message: ChatMessage;
  isFocused: boolean;
  isStreaming: boolean;
  onRetry?: (content: string) => void;
}

function MessageItemComponent({ message, isFocused, isStreaming, onRetry }: MessageItemProps) {
  const focusClasses = isFocused
    ? 'ring-2 ring-[var(--vscode-focusBorder)] ring-offset-2 ring-offset-[var(--vscode-editor-background)]'
    : '';
  const hoverClasses =
    'transition-shadow hover:ring-1 hover:ring-[color:color-mix(in_srgb,var(--vscode-focusBorder)_60%,transparent)]';

  if (message.role === MessageRole.USER) {
    const timeLabel = message.timestamp ? ` at ${message.timestamp.toLocaleTimeString()}` : '';
    return (
      <div className="rounded-xl" role="article" aria-label={`User message${timeLabel}`}>
        <UserMessage
          content={message.content}
          timestamp={message.timestamp}
          context={message.context}
          isFocused={isFocused}
        />
      </div>
    );
  }

  if (message.role === MessageRole.ASSISTANT) {
    const timeLabel = message.timestamp ? ` at ${message.timestamp.toLocaleTimeString()}` : '';
    return (
      <div
        className={`${focusClasses} ${hoverClasses} rounded-xl`}
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
        className={`${focusClasses} ${hoverClasses} rounded-xl pb-2`}
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

export const MessageItem = memo(MessageItemComponent);
