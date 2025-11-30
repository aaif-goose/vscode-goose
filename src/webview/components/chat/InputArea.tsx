import { useRef, useEffect, KeyboardEvent } from 'react';
import { SendButton } from './SendButton';
import { StopButton } from './StopButton';

interface InputAreaProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isGenerating: boolean;
  disabled: boolean;
}

const MAX_HEIGHT = 200;
const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

export function InputArea({
  value,
  onChange,
  onSend,
  onStop,
  isGenerating,
  disabled,
}: InputAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, MAX_HEIGHT);
    textarea.style.height = `${newHeight}px`;
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !isGenerating && value.trim()) {
        onSend();
      }
    }
  };

  const canSend = !disabled && !isGenerating && value.trim().length > 0;

  return (
    <div className="shrink-0 border-t border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-4">
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Goose..."
            disabled={disabled}
            rows={1}
            className="w-full resize-none bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-lg px-3 py-2 focus:outline-none focus:border-[var(--vscode-focusBorder)] placeholder:text-[var(--vscode-input-placeholderForeground)]"
            style={{ maxHeight: `${MAX_HEIGHT}px` }}
            aria-label="Message input"
          />
        </div>
        {isGenerating ? (
          <StopButton onClick={onStop} />
        ) : (
          <SendButton onClick={onSend} disabled={!canSend} />
        )}
      </div>
      <p className="text-xs text-[var(--vscode-descriptionForeground)] mt-2">
        {isMac ? '⌘' : 'Ctrl'}+↑/↓ to navigate messages
      </p>
    </div>
  );
}
