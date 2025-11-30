import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { ChatMessage, MessageStatus } from '../../../shared/types';
import { MessageItem } from './MessageItem';
import { useAutoScroll } from '../../hooks/useAutoScroll';

interface MessageListProps {
  messages: readonly ChatMessage[];
  isGenerating: boolean;
  focusedIndex: number | null;
  onMessageFocus: (index: number) => void;
  onRetry: (content: string) => void;
}

export interface MessageListHandle {
  scrollToMessage: (index: number) => void;
}

export const MessageList = forwardRef<MessageListHandle, MessageListProps>(function MessageList(
  { messages, isGenerating, focusedIndex, onMessageFocus, onRetry },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const { scrollToBottom } = useAutoScroll(containerRef, {
    isStreaming: isGenerating,
  });
  const prevMessageCountRef = useRef(messages.length);

  useImperativeHandle(
    ref,
    () => ({
      scrollToMessage: (index: number) => {
        const messageEl = messageRefs.current.get(index);
        if (messageEl) {
          messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      },
    }),
    []
  );

  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      scrollToBottom();
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, scrollToBottom]);

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
          <div
            key={message.id}
            ref={el => {
              if (el) {
                messageRefs.current.set(index, el);
              } else {
                messageRefs.current.delete(index);
              }
            }}
          >
            <MessageItem
              message={message}
              isFocused={focusedIndex === index}
              isStreaming={isGenerating && message.status === MessageStatus.STREAMING}
              onFocus={() => onMessageFocus(index)}
              onRetry={onRetry}
            />
          </div>
        ))}
      </div>
    </div>
  );
});
