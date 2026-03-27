import { KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import type { ContextChip, FileSearchResult } from '../../../shared/contextTypes';
import { isFocusChatInputMessage } from '../../../shared/messages';
import { SessionSettingsState } from '../../../shared/sessionTypes';
import { getState, onMessage, setState } from '../../bridge';
import { useFilePicker } from '../../hooks/useFilePicker';
import { FilePicker } from '../picker/FilePicker';
import { ChipStack } from './ChipStack';
import { SendButton } from './SendButton';
import { SessionSettingsBar } from './SessionSettingsBar';
import { StopButton } from './StopButton';

interface InputAreaProps {
  onSend: (content: string, chips?: readonly ContextChip[]) => void;
  onStop: () => void;
  isGenerating: boolean;
  disabled: boolean;
  activeSessionId?: string | null;
  chips?: readonly ContextChip[];
  onRemoveChip?: (chipId: string) => void;
  chipFocusedIndex?: number | null;
  onChipFocusChange?: (index: number | null) => void;
  onClearChips?: () => void;
  onAddFileChip?: (result: FileSearchResult) => void;
  chipAnnouncement?: string | null;
  settings: SessionSettingsState;
  onModeChange: (modeId: string) => void;
  onModelChange: (modelId: string) => void;
}

const MAX_HEIGHT = 200;
const DRAFT_PERSIST_DEBOUNCE_MS = 150;
const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
const PLACEHOLDER = `Message Goose... (${isMac ? '⌘' : 'Ctrl'}+↑/↓ to navigate)`;

interface PersistedState {
  inputDraft?: string;
  inputDraftsBySession?: Record<string, string>;
  unsessionedDraft?: string;
}

function getDraftForSession(state: PersistedState | undefined, sessionId?: string | null): string {
  if (!state) return '';

  if (sessionId) {
    return state.inputDraftsBySession?.[sessionId] ?? '';
  }

  return state.unsessionedDraft ?? state.inputDraft ?? '';
}

function setDraftForSession(
  state: PersistedState | undefined,
  sessionId: string | null | undefined,
  draft: string
): PersistedState {
  const nextState: PersistedState = {
    inputDraftsBySession: { ...(state?.inputDraftsBySession ?? {}) },
    unsessionedDraft: state?.unsessionedDraft ?? '',
  };

  if (sessionId) {
    if (draft) {
      nextState.inputDraftsBySession![sessionId] = draft;
    } else {
      delete nextState.inputDraftsBySession![sessionId];
    }
  } else {
    nextState.unsessionedDraft = draft;
  }

  return nextState;
}

export function InputArea({
  onSend,
  onStop,
  isGenerating,
  disabled,
  activeSessionId = null,
  chips = [],
  onRemoveChip,
  chipFocusedIndex = null,
  onChipFocusChange,
  onClearChips,
  onAddFileChip,
  chipAnnouncement = null,
  settings,
  onModeChange,
  onModelChange,
}: InputAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const draftPersistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [value, setValue] = useState(() =>
    getDraftForSession(getState<PersistedState>(), activeSessionId)
  );
  const latestValueRef = useRef(value);
  const sessionIdRef = useRef<string | null>(activeSessionId);

  // Initialize file picker hook
  // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional noop
  const noopAddChip = useCallback(() => {}, []);
  const filePicker = useFilePicker(onAddFileChip ?? noopAddChip, textareaRef, setValue);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  const persistDraft = useCallback((sessionId: string | null, draft: string) => {
    const persistedState = getState<PersistedState>();
    setState<PersistedState>(setDraftForSession(persistedState, sessionId, draft));
  }, []);

  useEffect(() => {
    if (sessionIdRef.current !== activeSessionId) {
      persistDraft(sessionIdRef.current, latestValueRef.current);
      sessionIdRef.current = activeSessionId;
      setValue(getDraftForSession(getState<PersistedState>(), activeSessionId));
    }
  }, [activeSessionId, persistDraft]);

  useEffect(() => {
    if (draftPersistTimeoutRef.current) {
      clearTimeout(draftPersistTimeoutRef.current);
    }

    draftPersistTimeoutRef.current = setTimeout(() => {
      persistDraft(sessionIdRef.current, value);
    }, DRAFT_PERSIST_DEBOUNCE_MS);

    return () => {
      if (draftPersistTimeoutRef.current) {
        clearTimeout(draftPersistTimeoutRef.current);
      }
    };
  }, [value, persistDraft]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: value triggers textarea resize
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const previousHeight = textarea.style.height;
    textarea.style.height = 'auto';
    const nextHeight = Math.min(textarea.scrollHeight, MAX_HEIGHT);
    const nextHeightPx = `${nextHeight}px`;
    if (previousHeight !== nextHeightPx) {
      textarea.style.height = nextHeightPx;
    } else {
      textarea.style.height = previousHeight;
    }

    const nextOverflow = textarea.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden';
    if (textarea.style.overflowY !== nextOverflow) {
      textarea.style.overflowY = nextOverflow;
    }
  }, [value]);

  // Click outside handler to close file picker
  useEffect(() => {
    if (!filePicker.isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        filePicker.close();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when isOpen or close changes, not entire filePicker object
  }, [filePicker.isOpen, filePicker.close]);

  // Subscribe to FOCUS_CHAT_INPUT message from extension
  useEffect(() => {
    const unsubscribe = onMessage(message => {
      if (isFocusChatInputMessage(message)) {
        textareaRef.current?.focus();
      }
    });
    return unsubscribe;
  }, []);

  const handleSend = useCallback(() => {
    if (disabled || isGenerating) return;

    const userInput = value.trim();
    const hasChips = chips.length > 0;

    if (!userInput && !hasChips) return;

    // Pass chips to onSend - extension will handle formatting
    onSend(userInput, hasChips ? chips : undefined);
    setValue('');
    persistDraft(sessionIdRef.current, '');
    onClearChips?.();
  }, [value, disabled, isGenerating, chips, onSend, onClearChips, persistDraft]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Pass keyboard events to file picker first
    if (filePicker.handleKeyDown(e)) {
      return;
    }

    const textarea = textareaRef.current;
    const cursorAtStart = textarea?.selectionStart === 0 && textarea?.selectionEnd === 0;

    // Handle keyboard navigation to chips
    if (chips.length > 0 && onChipFocusChange) {
      // Backspace at empty input or cursor at position 0 focuses last chip
      if (e.key === 'Backspace' && (value === '' || cursorAtStart)) {
        e.preventDefault();
        onChipFocusChange(chips.length - 1);
        return;
      }

      // Arrow left at input start moves focus to chip area
      if (e.key === 'ArrowLeft' && cursorAtStart) {
        e.preventDefault();
        onChipFocusChange(chips.length - 1);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Can send if there's user input OR if there are chips (context to send)
  const canSend = !disabled && !isGenerating && (value.trim().length > 0 || chips.length > 0);

  // Focus input when chip focus is cleared (e.g., after ArrowRight from last chip or Tab)
  useEffect(() => {
    if (chipFocusedIndex === null && chips.length > 0) {
      // Only refocus if we had chips (indicating navigation occurred)
      // This is handled by the ChipStack component setting focusedIndex to null
    }
  }, [chipFocusedIndex, chips.length]);

  const handleRemoveChip = useCallback(
    (chipId: string) => {
      onRemoveChip?.(chipId);
    },
    [onRemoveChip]
  );

  const handleChipFocusChange = useCallback(
    (index: number | null) => {
      onChipFocusChange?.(index);
      // If focus is moving out of chips (index is null), focus the textarea
      if (index === null) {
        textareaRef.current?.focus();
      }
    },
    [onChipFocusChange]
  );

  // Handle input change - update value and trigger @ detection
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const cursorPosition = e.target.selectionStart ?? 0;

      setValue(newValue);
      filePicker.handleInput(newValue, cursorPosition);
    },
    [filePicker]
  );

  // File picker navigation handlers
  const handleFilePickerNavigate = useCallback(
    (direction: 'up' | 'down') => {
      const e = {
        key: direction === 'up' ? 'ArrowUp' : 'ArrowDown',
        // biome-ignore lint/suspicious/noEmptyBlockStatements: mock event handler
        preventDefault: () => {},
      } as React.KeyboardEvent;
      filePicker.handleKeyDown(e);
    },
    [filePicker]
  );

  return (
    <div className="shrink-0 border-t border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] px-3 py-2.5">
      {/* Render ChipStack above the input area when chips exist, or show announcements */}
      {(chips.length > 0 || chipAnnouncement) && onRemoveChip && onChipFocusChange && (
        <ChipStack
          chips={chips}
          focusedIndex={chipFocusedIndex}
          onRemove={handleRemoveChip}
          onFocusChange={handleChipFocusChange}
          announcement={chipAnnouncement}
        />
      )}
      <div className="rounded-2xl border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div ref={containerRef} className="relative">
          {/* File picker dropdown */}
          <FilePicker
            isOpen={filePicker.isOpen}
            query={filePicker.query}
            results={filePicker.results}
            selectedIndex={filePicker.selectedIndex}
            onSelect={filePicker.selectResult}
            onClose={filePicker.close}
            onNavigate={handleFilePickerNavigate}
          />
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={PLACEHOLDER}
            disabled={disabled}
            rows={1}
            className="min-h-[36px] w-full resize-none border-0 bg-transparent px-1 py-0.5 text-[var(--vscode-input-foreground)] focus:outline-none placeholder:text-[var(--vscode-input-placeholderForeground)]"
            style={{ maxHeight: `${MAX_HEIGHT}px` }}
            aria-label="Message input"
          />
        </div>
        <div className="mt-2 flex flex-nowrap items-end justify-between gap-2">
          <div className="min-w-0 flex-1">
            <SessionSettingsBar
              settings={settings}
              disabled={disabled || isGenerating}
              onModeChange={onModeChange}
              onModelChange={onModelChange}
            />
          </div>
          <div className="shrink-0">
            {isGenerating ? (
              <StopButton onClick={onStop} />
            ) : (
              <SendButton onClick={handleSend} disabled={!canSend} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
