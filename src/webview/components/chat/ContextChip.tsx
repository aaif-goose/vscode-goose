import type { ContextChip as ContextChipType } from '../../../shared/contextTypes';
import { FileTypeIcon } from '../icons/FileTypeIcon';

interface ContextChipProps {
  chip: ContextChipType;
  isFocused: boolean;
  onRemove: () => void;
  onFocus: () => void;
}

/**
 * Individual chip displaying a file reference with optional line range.
 * Used for showing context selections in the chat input area.
 */
export function ContextChip({ chip, isFocused, onRemove, onFocus }: ContextChipProps) {
  const displayText = chip.range
    ? `${chip.fileName}:${chip.range.startLine}-${chip.range.endLine}`
    : chip.fileName;

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onRemove();
    }
  };

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={onFocus}
      onKeyDown={handleKeyDown}
      aria-label={`Context: ${displayText}. Press delete to remove.`}
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded
        bg-[var(--vscode-badge-background)]
        text-[var(--vscode-badge-foreground)]
        text-xs font-medium
        cursor-pointer
        transition-shadow
        ${isFocused ? 'ring-2 ring-[var(--vscode-focusBorder)]' : ''}
      `}
    >
      <FileTypeIcon languageId={chip.languageId} className="w-4 h-4 flex-shrink-0" />
      <span className="max-w-[150px] truncate">{displayText}</span>
      <button
        type="button"
        onClick={handleRemoveClick}
        className="
          flex items-center justify-center
          w-4 h-4 rounded-sm
          text-[var(--vscode-icon-foreground)]
          hover:bg-[var(--vscode-toolbar-hoverBackground)]
          focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]
          transition-colors
        "
        aria-label={`Remove ${displayText}`}
      >
        <CloseIcon className="w-3 h-3" />
      </button>
    </span>
  );
}


interface CloseIconProps {
  className?: string;
}

function CloseIcon({ className }: CloseIconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
