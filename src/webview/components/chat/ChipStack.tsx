import { useCallback, useEffect, useRef } from 'react';
import type { ContextChip as ContextChipType } from '../../../shared/contextTypes';
import { ContextChip } from './ContextChip';

interface ChipStackProps {
  chips: readonly ContextChipType[];
  focusedIndex: number | null;
  onRemove: (chipId: string) => void;
  onFocusChange: (index: number | null) => void;
  announcement?: string | null;
}

/**
 * Container for displaying context chips in a horizontal flex wrap layout.
 * Manages keyboard navigation between chips using arrow keys.
 */
export function ChipStack({
  chips,
  focusedIndex,
  onRemove,
  onFocusChange,
  announcement,
}: ChipStackProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Map<number, HTMLElement>>(new Map());

  // Focus the chip element when focusedIndex changes
  useEffect(() => {
    if (focusedIndex !== null && chipRefs.current.has(focusedIndex)) {
      chipRefs.current.get(focusedIndex)?.focus();
    }
  }, [focusedIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (chips.length === 0) return;

      switch (e.key) {
        case 'ArrowLeft': {
          e.preventDefault();
          if (focusedIndex === null) {
            // Focus last chip
            onFocusChange(chips.length - 1);
          } else if (focusedIndex > 0) {
            // Move focus left
            onFocusChange(focusedIndex - 1);
          }
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          if (focusedIndex !== null && focusedIndex < chips.length - 1) {
            // Move focus right
            onFocusChange(focusedIndex + 1);
          } else if (focusedIndex === chips.length - 1) {
            // At last chip, clear focus (move to input)
            onFocusChange(null);
          }
          break;
        }
        case 'Delete':
        case 'Backspace': {
          if (focusedIndex !== null) {
            e.preventDefault();
            const chipToRemove = chips[focusedIndex];
            if (chipToRemove) {
              // Determine new focus after removal
              const newFocusIndex =
                focusedIndex >= chips.length - 1
                  ? chips.length > 1
                    ? focusedIndex - 1
                    : null
                  : focusedIndex;
              onRemove(chipToRemove.id);
              onFocusChange(newFocusIndex);
            }
          }
          break;
        }
        case 'Tab': {
          // Tab moves focus out of chips to the input
          // Let the event propagate naturally
          if (focusedIndex !== null) {
            onFocusChange(null);
          }
          break;
        }
        case 'Escape': {
          // Clear chip focus
          if (focusedIndex !== null) {
            e.preventDefault();
            onFocusChange(null);
          }
          break;
        }
      }
    },
    [chips, focusedIndex, onFocusChange, onRemove]
  );

  const handleChipRemove = useCallback(
    (chipId: string, index: number) => {
      // Determine new focus after removal
      const newFocusIndex =
        index >= chips.length - 1 ? (chips.length > 1 ? index - 1 : null) : index;
      onRemove(chipId);
      onFocusChange(newFocusIndex);
    },
    [chips.length, onRemove, onFocusChange]
  );

  const handleChipFocus = useCallback(
    (index: number) => {
      onFocusChange(index);
    },
    [onFocusChange]
  );

  const setChipRef = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      if (el) {
        chipRefs.current.set(index, el);
      } else {
        chipRefs.current.delete(index);
      }
    },
    []
  );

  // Don't render if no chips (but still render aria-live for announcements)
  if (chips.length === 0) {
    // Render just the aria-live region for removal announcements
    return announcement ? (
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    ) : null;
  }

  return (
    <div
      ref={containerRef}
      role="list"
      aria-label="Context files"
      onKeyDown={handleKeyDown}
      className="
        flex flex-wrap gap-1.5 p-2
        border-b border-[var(--vscode-input-border)]
      "
    >
      {/* Screen reader announcements */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
      {chips.map((chip, index) => (
        <div key={chip.id} ref={setChipRef(index)} role="listitem">
          <ContextChip
            chip={chip}
            isFocused={focusedIndex === index}
            onRemove={() => handleChipRemove(chip.id, index)}
            onFocus={() => handleChipFocus(index)}
          />
        </div>
      ))}
    </div>
  );
}
