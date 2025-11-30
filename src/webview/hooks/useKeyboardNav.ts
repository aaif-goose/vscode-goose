import { useCallback, useEffect } from 'react';

interface UseKeyboardNavOptions {
  messageCount: number;
  focusedIndex: number | null;
  setFocusedIndex: (index: number | null) => void;
  scrollToMessage: (index: number) => void;
  isGenerating: boolean;
  onStopGeneration: () => void;
}

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

export function useKeyboardNav({
  messageCount,
  focusedIndex,
  setFocusedIndex,
  scrollToMessage,
  isGenerating,
  onStopGeneration,
}: UseKeyboardNavOptions): void {
  const navigateToPrevious = useCallback(() => {
    if (messageCount === 0) return;

    const newIndex = focusedIndex === null ? messageCount - 1 : Math.max(0, focusedIndex - 1);

    setFocusedIndex(newIndex);
    scrollToMessage(newIndex);
  }, [messageCount, focusedIndex, setFocusedIndex, scrollToMessage]);

  const navigateToNext = useCallback(() => {
    if (messageCount === 0) return;

    if (focusedIndex === null) {
      setFocusedIndex(0);
      scrollToMessage(0);
      return;
    }

    const newIndex = Math.min(messageCount - 1, focusedIndex + 1);
    setFocusedIndex(newIndex);
    scrollToMessage(newIndex);
  }, [messageCount, focusedIndex, setFocusedIndex, scrollToMessage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isGenerating) {
        e.preventDefault();
        onStopGeneration();
        return;
      }

      const modifier = isMac ? e.metaKey : e.ctrlKey;
      if (!modifier) return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateToPrevious();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateToNext();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navigateToPrevious, navigateToNext, isGenerating, onStopGeneration]);
}
