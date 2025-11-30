import { useChat } from '../../hooks/useChat';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';

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
  } = useChat();

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <MessageList
        messages={messages}
        isGenerating={isGenerating}
        focusedIndex={focusedIndex}
        onMessageFocus={setFocusedIndex}
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
