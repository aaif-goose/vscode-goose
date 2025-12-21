import type { FileSearchResult } from '../../../shared/contextTypes';
import { FileTypeIcon } from '../icons/FileTypeIcon';

interface FilePickerItemProps {
  result: FileSearchResult;
  isSelected: boolean;
  onSelect: () => void;
}

/**
 * Individual file result item in the @ file picker dropdown.
 * Displays language icon, filename (prioritized), and relative path.
 */
export function FilePickerItem({ result, isSelected, onSelect }: FilePickerItemProps) {
  return (
    <div
      role="option"
      aria-selected={isSelected}
      onClick={onSelect}
      className={`
        flex items-center gap-2 px-3 py-1.5
        cursor-pointer
        ${isSelected ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]' : ''}
        hover:bg-[var(--vscode-list-hoverBackground)]
        transition-colors
      `}
    >
      <FileTypeIcon languageId={result.languageId} className="w-4 h-4 flex-shrink-0" />
      <span className="flex-shrink-0 font-medium">{result.fileName}</span>
      {result.relativePath && (
        <span className="truncate text-[var(--vscode-descriptionForeground)] text-sm min-w-0">
          {result.relativePath}
        </span>
      )}
    </div>
  );
}
