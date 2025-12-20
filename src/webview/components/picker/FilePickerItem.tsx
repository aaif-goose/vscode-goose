import type { FileSearchResult } from '../../../shared/contextTypes';

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
      <LanguageIcon languageId={result.languageId} />
      <span className="truncate font-medium">{result.fileName}</span>
      {relativePath && (
        <span className="truncate text-[var(--vscode-descriptionForeground)] text-sm">
          {relativePath}
        </span>
      )}
    </div>
  );
}

interface LanguageIconProps {
  languageId: string;
}

function LanguageIcon({ languageId }: LanguageIconProps) {
  const iconClass = getLanguageIconClass(languageId);
  return (
    <span
      className={`codicon ${iconClass} text-[var(--vscode-icon-foreground)] flex-shrink-0`}
      aria-hidden="true"
    />
  );
}

function getLanguageIconClass(languageId: string): string {
  const languageIconMap: Record<string, string> = {
    typescript: 'codicon-symbol-class',
    typescriptreact: 'codicon-symbol-class',
    javascript: 'codicon-symbol-method',
    javascriptreact: 'codicon-symbol-method',
    python: 'codicon-symbol-namespace',
    rust: 'codicon-symbol-struct',
    go: 'codicon-symbol-interface',
    java: 'codicon-symbol-class',
    csharp: 'codicon-symbol-class',
    cpp: 'codicon-symbol-struct',
    c: 'codicon-symbol-struct',
    html: 'codicon-symbol-misc',
    css: 'codicon-symbol-color',
    scss: 'codicon-symbol-color',
    json: 'codicon-json',
    markdown: 'codicon-markdown',
    yaml: 'codicon-symbol-key',
    xml: 'codicon-symbol-misc',
    sql: 'codicon-database',
    shell: 'codicon-terminal',
    bash: 'codicon-terminal',
    powershell: 'codicon-terminal-powershell',
  };

  return languageIconMap[languageId] ?? 'codicon-file';
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
