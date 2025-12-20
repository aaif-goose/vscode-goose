import { useRef, useCallback } from 'react';
import { UseChatReturn } from '../../hooks/useChat';
import { useKeyboardNav } from '../../hooks/useKeyboardNav';
import { useContextChips } from '../../hooks/useContextChips';
import { MessageList, MessageListHandle } from './MessageList';
import { InputArea } from './InputArea';
import type { FileSearchResult, ContextChip } from '../../../shared/contextTypes';

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

  const {
    chips,
    addChip,
    removeChip,
    clearChips,
    focusedIndex: chipFocusedIndex,
    setFocusedIndex: setChipFocusedIndex,
    getContextPrefix,
    hasDuplicate,
    announcement: chipAnnouncement,
  } = useContextChips();

  const messageListRef = useRef<MessageListHandle>(null);

  // Convert FileSearchResult to ContextChip and add it
  const handleAddFileChip = useCallback(
    (result: FileSearchResult) => {
      // Check for duplicates (file without line range)
      if (hasDuplicate(result.path)) {
        return;
      }

      const chip: ContextChip = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        filePath: result.path,
        fileName: result.fileName,
        languageId: result.languageId,
        // No range for @ picker selections (whole file)
      };

      addChip(chip);
    },
    [addChip, hasDuplicate]
  );

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
        chips={chips}
        onRemoveChip={removeChip}
        chipFocusedIndex={chipFocusedIndex}
        onChipFocusChange={setChipFocusedIndex}
        getContextPrefix={getContextPrefix}
        onClearChips={clearChips}
        onAddFileChip={handleAddFileChip}
        chipAnnouncement={chipAnnouncement}
      />
    </div>
  );
}
