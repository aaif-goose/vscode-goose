import { forwardRef, memo, useEffect, useImperativeHandle, useRef } from 'react';
import { ChatMessage, MessageStatus } from '../../../shared/types';
import { useAutoScroll } from '../../hooks/useAutoScroll';
import { GooseWatermark } from '../icons/GooseWatermark';
import { MessageItem } from './MessageItem';

interface MessageListProps {
  messages: readonly ChatMessage[];
  isGenerating: boolean;
  focusedIndex: number | null;
  onRetry: (content: string) => void;
}

export interface MessageListHandle {
  scrollToMessage: (index: number) => void;
}

const MessageListComponent = forwardRef<MessageListHandle, MessageListProps>(function MessageList(
  { messages, isGenerating, focusedIndex, onRetry },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const { scrollToBottom } = useAutoScroll(containerRef, {
    isStreaming: isGenerating,
  });
  const prevMessageCountRef = useRef(0);
  const hasInitialScrolled = useRef(false);

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

  // Scroll to bottom when messages are added or on initial load
  useEffect(() => {
    if (messages.length > 0) {
      // Initial scroll or new messages added
      if (!hasInitialScrolled.current || messages.length > prevMessageCountRef.current) {
        scrollToBottom();
        hasInitialScrolled.current = true;
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, scrollToBottom]);

  if (messages.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center p-4"
      >
        <GooseWatermark />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 overflow-y-auto p-4"
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
    >
      <div className="flex flex-col gap-5">
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
              onRetry={onRetry}
            />
          </div>
        ))}
      </div>
    </div>
  );
});

MessageListComponent.displayName = 'MessageList';

export const MessageList = memo(MessageListComponent);
