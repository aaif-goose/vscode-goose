import { useRef } from 'react';
import { ChatMessage, MessageStatus } from '../../../shared/types';
import { MessageItem } from './MessageItem';

interface MessageListProps {
  messages: readonly ChatMessage[];
  isGenerating: boolean;
  focusedIndex: number | null;
  onMessageFocus: (index: number) => void;
}

export function MessageList({
  messages,
  isGenerating,
  focusedIndex,
  onMessageFocus,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  if (messages.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto flex items-center justify-center p-4"
      >
        <p className="text-[var(--vscode-descriptionForeground)] text-center">
          Start a conversation with Goose
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4"
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
    >
      <div className="flex flex-col gap-6">
        {messages.map((message, index) => (
          <MessageItem
            key={message.id}
            message={message}
            isFocused={focusedIndex === index}
            isStreaming={isGenerating && message.status === MessageStatus.STREAMING}
            onFocus={() => onMessageFocus(index)}
          />
        ))}
      </div>
    </div>
  );
}
