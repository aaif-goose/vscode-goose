import { useRef, useCallback } from 'react';
import { UseChatReturn } from '../../hooks/useChat';
import { useKeyboardNav } from '../../hooks/useKeyboardNav';
import { MessageList, MessageListHandle } from './MessageList';
import { InputArea } from './InputArea';

interface ChatViewProps {
  className?: string;
  chat: UseChatReturn;
}

export function ChatView({ className = '', chat }: ChatViewProps) {
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
  } = chat;

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
