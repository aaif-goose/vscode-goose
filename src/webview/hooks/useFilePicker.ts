/**
 * File picker hook for @ mention file search functionality.
 * Detects @ triggers, manages search state, and handles keyboard navigation.
 */

import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { FileSearchResult } from '../../shared/contextTypes';
import { createFileSearchMessage, isSearchResultsMessage } from '../../shared/messages';
import { onMessage, postMessage } from '../bridge';

interface FilePickerState {
  isOpen: boolean;
  query: string;
  results: readonly FileSearchResult[];
  selectedIndex: number;
  atPosition: number;
}

const initialState: FilePickerState = {
  isOpen: false,
  query: '',
  results: [],
  selectedIndex: 0,
  atPosition: -1,
};

const DEBOUNCE_MS = 100;

export interface UseFilePickerReturn {
  isOpen: boolean;
  query: string;
  results: readonly FileSearchResult[];
  selectedIndex: number;
  handleInput: (value: string, cursorPosition: number) => void;
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
  selectResult: (result: FileSearchResult) => void;
  close: () => void;
}

/**
 * Detects @ trigger at word boundary and extracts query text.
 * Returns the position of @ and the query text, or null if no trigger found.
 */
function detectAtTrigger(
  value: string,
  cursorPosition: number
): { atPosition: number; query: string } | null {
  // Look backwards from cursor to find @
  let atPosition = -1;
  for (let i = cursorPosition - 1; i >= 0; i--) {
    const char = value[i];
    // Stop if we hit whitespace before finding @
    if (/\s/.test(char)) {
      break;
    }
    if (char === '@') {
      // Check if @ is at word boundary (start of string or preceded by whitespace)
      if (i === 0 || /\s/.test(value[i - 1])) {
        atPosition = i;
      }
      break;
    }
  }

  if (atPosition === -1) {
    return null;
  }

  // Extract query text between @ and cursor
  const query = value.slice(atPosition + 1, cursorPosition);

  return { atPosition, query };
}

export function useFilePicker(
  onAddChip: (result: FileSearchResult) => void,
  inputRef: RefObject<HTMLTextAreaElement>,
  onInputChange?: (value: string) => void
): UseFilePickerReturn {
  const [state, setState] = useState<FilePickerState>(initialState);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef<string | null>(null);

  // Subscribe to SEARCH_RESULTS messages
  useEffect(() => {
    const unsubscribe = onMessage(message => {
      if (isSearchResultsMessage(message)) {
        setState(prev => ({
          ...prev,
          results: message.payload.results,
          selectedIndex: 0,
        }));
      }
    });

    return unsubscribe;
  }, []);

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const sendSearchRequest = useCallback((query: string) => {
    postMessage(createFileSearchMessage(query));
  }, []);

  const handleInput = useCallback(
    (value: string, cursorPosition: number) => {
      const trigger = detectAtTrigger(value, cursorPosition);

      if (trigger) {
        const { atPosition, query } = trigger;

        setState(prev => ({
          ...prev,
          isOpen: true,
          query,
          atPosition,
          selectedIndex: 0,
        }));

        // Send search request on first open or when query changes
        // lastQueryRef is null initially, so first open always triggers search
        if (lastQueryRef.current === null || query !== lastQueryRef.current) {
          lastQueryRef.current = query;

          if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
          }

          debounceTimeoutRef.current = setTimeout(() => {
            sendSearchRequest(query);
          }, DEBOUNCE_MS);
        }
      } else {
        // No @ trigger found, close picker
        if (state.isOpen) {
          setState(initialState);
          lastQueryRef.current = null;
        }
      }
    },
    [state.isOpen, sendSearchRequest]
  );

  const close = useCallback(() => {
    setState(initialState);
    lastQueryRef.current = null;
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
  }, []);

  const selectResult = useCallback(
    (result: FileSearchResult) => {
      // Add chip via callback
      onAddChip(result);

      // Remove @query from input
      const textarea = inputRef.current;
      if (textarea && state.atPosition !== -1) {
        const value = textarea.value;
        const beforeAt = value.slice(0, state.atPosition);
        const afterQuery = value.slice(state.atPosition + 1 + state.query.length);
        const newValue = beforeAt + afterQuery;

        // Update React state via callback
        onInputChange?.(newValue);

        // Set cursor position to where @ was (after React re-render)
        setTimeout(() => {
          const newCursorPosition = state.atPosition;
          textarea.setSelectionRange(newCursorPosition, newCursorPosition);
          textarea.focus();
        }, 0);
      }

      // Close picker
      close();
    },
    [onAddChip, inputRef, state.atPosition, state.query, close, onInputChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!state.isOpen) {
        return false;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setState(prev => ({
            ...prev,
            selectedIndex: Math.min(prev.selectedIndex + 1, prev.results.length - 1),
          }));
          return true;

        case 'ArrowUp':
          e.preventDefault();
          setState(prev => ({
            ...prev,
            selectedIndex: Math.max(prev.selectedIndex - 1, 0),
          }));
          return true;

        case 'Enter':
          if (state.results.length > 0 && state.selectedIndex < state.results.length) {
            e.preventDefault();
            selectResult(state.results[state.selectedIndex]);
            return true;
          }
          return false;

        case 'Escape':
          e.preventDefault();
          close();
          return true;

        case 'Tab':
          // Tab selects the highlighted result (like Enter)
          if (state.results.length > 0 && state.selectedIndex < state.results.length) {
            e.preventDefault();
            selectResult(state.results[state.selectedIndex]);
            return true;
          }
          close();
          return false;

        default:
          return false;
      }
    },
    [state.isOpen, state.results, state.selectedIndex, selectResult, close]
  );

  return {
    isOpen: state.isOpen,
    query: state.query,
    results: state.results,
    selectedIndex: state.selectedIndex,
    handleInput,
    handleKeyDown,
    selectResult,
    close,
  };
}
