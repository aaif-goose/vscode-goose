import { useCallback, useRef } from 'react';
import { useChat } from '../../hooks/useChat';
import { useKeyboardNav } from '../../hooks/useKeyboardNav';
import { InputArea } from './InputArea';
import { MessageList, MessageListHandle } from './MessageList';

interface ChatContainerProps {
  className?: string;
}

export function ChatContainer({ className = '' }: ChatContainerProps) {
  const {
    messages,
    isGenerating,
    inputValue,
    setInputValue,
    sendMessage,
    stopGeneration,
    focusedIndex,
    setFocusedIndex,
    retryMessage,
  } = useChat();

  const messageListRef = useRef<MessageListHandle>(null);

  const scrollToMessage = useCallback((index: number) => {
    messageListRef.current?.scrollToMessage(index);
  }, []);

  useKeyboardNav({
    messageCount: messages.length,
    focusedIndex,
    setFocusedIndex,
    scrollToMessage,
    isGenerating,
    onStopGeneration: stopGeneration,
  });

  return (
    <div
      className={`flex flex-col h-full ${className}`}
      aria-busy={isGenerating}
      aria-label="Chat with Goose"
    >
      <MessageList
        ref={messageListRef}
        messages={messages}
        isGenerating={isGenerating}
        focusedIndex={focusedIndex}
        onMessageFocus={setFocusedIndex}
        onRetry={retryMessage}
      />
      <InputArea
        value={inputValue}
        onChange={setInputValue}
        onSend={sendMessage}
        onStop={stopGeneration}
        isGenerating={isGenerating}
        disabled={false}
      />
    </div>
  );
}
