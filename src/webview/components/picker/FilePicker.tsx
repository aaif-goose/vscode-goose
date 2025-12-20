import { useEffect, useRef } from 'react';
import type { FileSearchResult } from '../../../shared/contextTypes';
import { FilePickerItem } from './FilePickerItem';

interface FilePickerProps {
  isOpen: boolean;
  query: string;
  results: readonly FileSearchResult[];
  selectedIndex: number;
  onSelect: (result: FileSearchResult) => void;
  onClose: () => void;
  onNavigate: (direction: 'up' | 'down') => void;
}

/**
 * Dropdown component for @ file search picker.
 * Positioned above the input area, displays workspace files with fuzzy search.
 */
export function FilePicker({
  isOpen,
  query,
  results,
  selectedIndex,
  onSelect,
  onClose,
  onNavigate,
}: FilePickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          onClose();
          break;
        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          onNavigate('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          onNavigate('down');
          break;
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          if (results.length > 0 && selectedIndex >= 0 && selectedIndex < results.length) {
            onSelect(results[selectedIndex]);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, results, selectedIndex, onClose, onNavigate, onSelect]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedItemRef.current && containerRef.current) {
      selectedItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  if (!isOpen) {
    return null;
  }

  const hasQuery = query.length > 0;
  const hasResults = results.length > 0;

  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label="File search results"
      className="
        absolute bottom-full left-0 w-full mb-1
        bg-[var(--vscode-dropdown-background)]
        border border-[var(--vscode-dropdown-border)]
        rounded shadow-lg
        max-h-[200px] overflow-y-auto
        z-50
      "
    >
      {hasResults ? (
        results.map((result, index) => (
          <div key={result.path} ref={index === selectedIndex ? selectedItemRef : undefined}>
            <FilePickerItem
              result={result}
              isSelected={index === selectedIndex}
              onSelect={() => onSelect(result)}
            />
          </div>
        ))
      ) : hasQuery ? (
        <div
          className="
            px-3 py-2
            text-[var(--vscode-descriptionForeground)]
            text-sm
          "
        >
          No results found
        </div>
      ) : null}
    </div>
  );
}
