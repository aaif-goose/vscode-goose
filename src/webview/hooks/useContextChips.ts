/**
 * Context chips hook for managing file and selection references.
 * Handles chip state, keyboard navigation, and message formatting.
 */

import { useCallback, useEffect, useReducer } from 'react';
import { ContextChip, LineRange } from '../../shared/contextTypes';
import { isAddContextChipMessage } from '../../shared/messages';
import { onMessage } from '../bridge';

interface ContextChipsState {
  chips: ContextChip[];
  focusedIndex: number | null;
  announcement: string | null;
}

type ContextChipsAction =
  | { type: 'ADD_CHIP'; payload: ContextChip }
  | { type: 'REMOVE_CHIP'; payload: { chipId: string; chipName: string } }
  | { type: 'CLEAR_CHIPS' }
  | { type: 'SET_FOCUSED_INDEX'; payload: number | null }
  | { type: 'CLEAR_ANNOUNCEMENT' };

const initialState: ContextChipsState = {
  chips: [],
  focusedIndex: null,
  announcement: null,
};

function formatChipDisplayName(chip: ContextChip): string {
  return chip.range
    ? `${chip.fileName}:${chip.range.startLine}-${chip.range.endLine}`
    : chip.fileName;
}

function contextChipsReducer(
  state: ContextChipsState,
  action: ContextChipsAction
): ContextChipsState {
  switch (action.type) {
    case 'ADD_CHIP': {
      const displayName = formatChipDisplayName(action.payload);
      return {
        ...state,
        chips: [...state.chips, action.payload],
        announcement: `Added context: ${displayName}`,
      };
    }

    case 'REMOVE_CHIP': {
      const newChips = state.chips.filter(chip => chip.id !== action.payload.chipId);
      const newFocusedIndex =
        state.focusedIndex !== null && state.focusedIndex >= newChips.length
          ? newChips.length > 0
            ? newChips.length - 1
            : null
          : state.focusedIndex;
      return {
        ...state,
        chips: newChips,
        focusedIndex: newFocusedIndex,
        announcement: `Removed context: ${action.payload.chipName}`,
      };
    }

    case 'CLEAR_CHIPS':
      return {
        ...state,
        chips: [],
        focusedIndex: null,
        announcement: null,
      };

    case 'SET_FOCUSED_INDEX':
      return {
        ...state,
        focusedIndex: action.payload,
      };

    case 'CLEAR_ANNOUNCEMENT':
      return {
        ...state,
        announcement: null,
      };

    default:
      return state;
  }
}

function rangesEqual(a?: LineRange, b?: LineRange): boolean {
  if (a === undefined && b === undefined) return true;
  if (a === undefined || b === undefined) return false;
  return a.startLine === b.startLine && a.endLine === b.endLine;
}

export interface UseContextChipsReturn {
  chips: readonly ContextChip[];
  addChip: (chip: ContextChip) => void;
  removeChip: (chipId: string) => void;
  clearChips: () => void;
  focusedIndex: number | null;
  setFocusedIndex: (index: number | null) => void;
  getContextPrefix: () => string;
  hasDuplicate: (filePath: string, range?: LineRange) => boolean;
  announcement: string | null;
}

export function useContextChips(): UseContextChipsReturn {
  const [state, dispatch] = useReducer(contextChipsReducer, initialState);

  useEffect(() => {
    const unsubscribe = onMessage(message => {
      if (isAddContextChipMessage(message)) {
        dispatch({ type: 'ADD_CHIP', payload: message.payload.chip });
      }
    });

    return unsubscribe;
  }, []);

  const addChip = useCallback((chip: ContextChip) => {
    dispatch({ type: 'ADD_CHIP', payload: chip });
  }, []);

  const removeChip = useCallback(
    (chipId: string) => {
      const chip = state.chips.find(c => c.id === chipId);
      const chipName = chip ? formatChipDisplayName(chip) : chipId;
      dispatch({ type: 'REMOVE_CHIP', payload: { chipId, chipName } });
    },
    [state.chips]
  );

  const clearChips = useCallback(() => {
    dispatch({ type: 'CLEAR_CHIPS' });
  }, []);

  const setFocusedIndex = useCallback((index: number | null) => {
    dispatch({ type: 'SET_FOCUSED_INDEX', payload: index });
  }, []);

  const hasDuplicate = useCallback(
    (filePath: string, range?: LineRange): boolean => {
      return state.chips.some(chip => chip.filePath === filePath && rangesEqual(chip.range, range));
    },
    [state.chips]
  );

  const getContextPrefix = useCallback((): string => {
    if (state.chips.length === 0) {
      return '';
    }

    const lines = state.chips.map(chip => {
      if (chip.range) {
        return `- ${chip.filePath}:${chip.range.startLine}-${chip.range.endLine}`;
      }
      return `- ${chip.filePath}`;
    });

    return `Additional context to work with:\n${lines.join('\n')}\n\n`;
  }, [state.chips]);

  return {
    chips: state.chips,
    addChip,
    removeChip,
    clearChips,
    focusedIndex: state.focusedIndex,
    setFocusedIndex,
    getContextPrefix,
    hasDuplicate,
    announcement: state.announcement,
  };
}
