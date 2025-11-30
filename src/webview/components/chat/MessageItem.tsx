import { ChatMessage, MessageRole } from '../../../shared/types';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';

interface MessageItemProps {
  message: ChatMessage;
  isFocused: boolean;
  isStreaming: boolean;
  onFocus: () => void;
}

export function MessageItem({ message, isFocused, isStreaming, onFocus }: MessageItemProps) {
  const focusClasses = isFocused
    ? 'ring-2 ring-[var(--vscode-focusBorder)] ring-offset-2 ring-offset-[var(--vscode-editor-background)]'
    : '';

  if (message.role === MessageRole.USER) {
    return (
      <div
        className={`${focusClasses} rounded-lg`}
        onClick={onFocus}
        role="article"
        aria-label={`User message at ${message.timestamp.toLocaleTimeString()}`}
      >
        <UserMessage content={message.content} timestamp={message.timestamp} />
      </div>
    );
  }

  if (message.role === MessageRole.ASSISTANT) {
    return (
      <div
        className={`${focusClasses} rounded-lg`}
        onClick={onFocus}
        role="article"
        aria-label={`Assistant message at ${message.timestamp.toLocaleTimeString()}`}
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
        className={`${focusClasses} rounded-lg p-3 bg-[var(--vscode-inputValidation-errorBackground)] border border-[var(--vscode-inputValidation-errorBorder)]`}
        onClick={onFocus}
        role="alert"
      >
        <p className="text-[var(--vscode-errorForeground)]">{message.content}</p>
      </div>
    );
  }

  return null;
}
