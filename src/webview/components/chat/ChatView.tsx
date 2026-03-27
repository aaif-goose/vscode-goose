import { useCallback, useRef } from 'react';
import type { ContextChip, FileSearchResult } from '../../../shared/contextTypes';
import { SessionSettingsState } from '../../../shared/sessionTypes';
import { UseChatReturn } from '../../hooks/useChat';
import { UseContextChipsReturn } from '../../hooks/useContextChips';
import { useKeyboardNav } from '../../hooks/useKeyboardNav';
import { InputArea } from './InputArea';
import { MessageList, MessageListHandle } from './MessageList';

interface ChatViewProps {
  className?: string;
  chat: UseChatReturn;
  contextChips: UseContextChipsReturn;
  activeSessionId: string | null;
  settings: SessionSettingsState;
  setSessionMode: (modeId: string) => void;
  setSessionModel: (modelId: string) => void;
}

export function ChatView({
  className = '',
  chat,
  contextChips,
  activeSessionId,
  settings,
  setSessionMode,
  setSessionModel,
}: ChatViewProps) {
  const {
    messages,
    isGenerating,
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
    hasDuplicate,
    announcement: chipAnnouncement,
  } = contextChips;

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
      className={`flex flex-col min-h-0 ${className}`}
      aria-busy={isGenerating}
      aria-label="Chat with Goose"
    >
      <MessageList
        ref={messageListRef}
        messages={messages}
        isGenerating={isGenerating}
        focusedIndex={focusedIndex}
        onRetry={retryMessage}
      />
      <InputArea
        activeSessionId={activeSessionId}
        onSend={sendMessage}
        onStop={stopGeneration}
        isGenerating={isGenerating}
        disabled={false}
        chips={chips}
        onRemoveChip={removeChip}
        chipFocusedIndex={chipFocusedIndex}
        onChipFocusChange={setChipFocusedIndex}
        onClearChips={clearChips}
        onAddFileChip={handleAddFileChip}
        chipAnnouncement={chipAnnouncement}
        settings={settings}
        onModeChange={setSessionMode}
        onModelChange={setSessionModel}
      />
    </div>
  );
}
