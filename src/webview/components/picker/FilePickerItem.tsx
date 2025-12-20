import type { FileSearchResult } from '../../../shared/contextTypes';
import { FileTypeIcon } from '../icons/FileTypeIcon';

interface FilePickerItemProps {
  result: FileSearchResult;
  isSelected: boolean;
  onSelect: () => void;
}

/**
 * Individual file result item in the @ file picker dropdown.
 * Displays language icon, filename, and relative path.
 */
export function FilePickerItem({ result, isSelected, onSelect }: FilePickerItemProps) {
  const relativePath = getRelativePath(result.path, result.fileName);

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
      <span className="truncate font-medium">{result.fileName}</span>
      {relativePath && (
        <span className="truncate text-[var(--vscode-descriptionForeground)] text-sm">
          {relativePath}
        </span>
      )}
    </div>
  );
}


/**
 * Extracts the relative path from a full file path, excluding the filename.
 * Returns the directory path or empty string if file is at root.
 */
function getRelativePath(fullPath: string, fileName: string): string {
  // Remove the filename from the path to get the directory
  const pathWithoutFilename = fullPath.slice(0, fullPath.length - fileName.length);

  // Clean up trailing slashes and return
  const cleanPath = pathWithoutFilename.replace(/[/\\]+$/, '');

  // If path is empty or just a drive letter, return empty
  if (!cleanPath || /^[a-zA-Z]:?$/.test(cleanPath)) {
    return '';
  }

  return cleanPath;
}
