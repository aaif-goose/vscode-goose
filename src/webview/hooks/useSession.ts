/**
 * Session management hook for the webview.
 * Manages session list state and communication with extension.
 */

import { useCallback, useEffect, useReducer } from 'react';
import {
  createCreateSessionMessage,
  createGetSessionsMessage,
  createSelectSessionMessage,
  createSetSessionModelMessage,
  createSetSessionModeMessage,
  isHistoryCompleteMessage,
  isSessionCreatedMessage,
  isSessionLoadedMessage,
  isSessionSettingsMessage,
  isSessionsListMessage,
} from '../../shared/messages';
import {
  EMPTY_SESSION_SETTINGS,
  GroupedSessions,
  groupSessionsByDate,
  SessionEntry,
  SessionSettingsState,
} from '../../shared/sessionTypes';
import { onMessage, postMessage } from '../bridge';

interface SessionState {
  sessions: SessionEntry[];
  activeSessionId: string | null;
  isPanelOpen: boolean;
  isLoading: boolean;
  isLoadingHistory: boolean;
  historyUnavailable: boolean;
  settings: SessionSettingsState;
}

type SessionAction =
  | { type: 'SET_SESSIONS'; payload: { sessions: SessionEntry[]; activeSessionId: string | null } }
  | { type: 'SET_ACTIVE_SESSION'; payload: string }
  | { type: 'ADD_SESSION'; payload: SessionEntry }
  | { type: 'TOGGLE_PANEL' }
  | { type: 'CLOSE_PANEL' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_LOADING_HISTORY'; payload: boolean }
  | { type: 'SET_HISTORY_UNAVAILABLE'; payload: boolean }
  | { type: 'SET_SETTINGS'; payload: SessionSettingsState };

const initialState: SessionState = {
  sessions: [],
  activeSessionId: null,
  isPanelOpen: false,
  isLoading: false,
  isLoadingHistory: false,
  historyUnavailable: false,
  settings: EMPTY_SESSION_SETTINGS,
};

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'SET_SESSIONS':
      return {
        ...state,
        sessions: action.payload.sessions,
        activeSessionId: action.payload.activeSessionId,
        isLoading: false,
      };

    case 'SET_ACTIVE_SESSION':
      return {
        ...state,
        activeSessionId: action.payload,
      };

    case 'ADD_SESSION':
      return {
        ...state,
        sessions: [
          action.payload,
          ...state.sessions.filter(s => s.sessionId !== action.payload.sessionId),
        ],
        activeSessionId: action.payload.sessionId,
      };

    case 'TOGGLE_PANEL':
      return {
        ...state,
        isPanelOpen: !state.isPanelOpen,
      };

    case 'CLOSE_PANEL':
      return {
        ...state,
        isPanelOpen: false,
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'SET_LOADING_HISTORY':
      return {
        ...state,
        isLoadingHistory: action.payload,
      };

    case 'SET_HISTORY_UNAVAILABLE':
      return {
        ...state,
        historyUnavailable: action.payload,
        isLoadingHistory: false,
      };

    case 'SET_SETTINGS':
      return {
        ...state,
        settings: action.payload,
      };

    default:
      return state;
  }
}

export interface UseSessionReturn {
  sessions: readonly SessionEntry[];
  groupedSessions: readonly GroupedSessions[];
  activeSessionId: string | null;
  activeSession: SessionEntry | null;
  isPanelOpen: boolean;
  isLoading: boolean;
  isLoadingHistory: boolean;
  historyUnavailable: boolean;
  settings: SessionSettingsState;
  togglePanel: () => void;
  closePanel: () => void;
  selectSession: (sessionId: string) => void;
  createSession: () => void;
  refreshSessions: () => void;
  setSessionMode: (modeId: string) => void;
  setSessionModel: (modelId: string) => void;
}

export function useSession(): UseSessionReturn {
  const [state, dispatch] = useReducer(sessionReducer, initialState);

  useEffect(() => {
    postMessage(createGetSessionsMessage());
  }, []);

  useEffect(() => {
    const unsubscribe = onMessage(message => {
      if (isSessionsListMessage(message)) {
        dispatch({
          type: 'SET_SESSIONS',
          payload: {
            sessions: message.payload.sessions as SessionEntry[],
            activeSessionId: message.payload.activeSessionId,
          },
        });
      } else if (isSessionCreatedMessage(message)) {
        dispatch({
          type: 'ADD_SESSION',
          payload: message.payload.session,
        });
      } else if (isSessionLoadedMessage(message)) {
        dispatch({ type: 'SET_ACTIVE_SESSION', payload: message.payload.sessionId });
        dispatch({
          type: 'SET_HISTORY_UNAVAILABLE',
          payload: message.payload.historyUnavailable ?? false,
        });
      } else if (isHistoryCompleteMessage(message)) {
        dispatch({ type: 'SET_LOADING_HISTORY', payload: false });
      } else if (isSessionSettingsMessage(message)) {
        dispatch({ type: 'SET_SETTINGS', payload: message.payload.settings });
      }
    });

    return unsubscribe;
  }, []);

  const togglePanel = useCallback(() => {
    dispatch({ type: 'TOGGLE_PANEL' });
    if (!state.isPanelOpen) {
      postMessage(createGetSessionsMessage());
    }
  }, [state.isPanelOpen]);

  const closePanel = useCallback(() => {
    dispatch({ type: 'CLOSE_PANEL' });
  }, []);

  const selectSession = useCallback((sessionId: string) => {
    dispatch({ type: 'SET_LOADING_HISTORY', payload: true });
    dispatch({ type: 'SET_HISTORY_UNAVAILABLE', payload: false });
    postMessage(createSelectSessionMessage(sessionId));
  }, []);

  const createSession = useCallback(() => {
    dispatch({ type: 'SET_LOADING', payload: true });
    postMessage(createCreateSessionMessage());
  }, []);

  const refreshSessions = useCallback(() => {
    dispatch({ type: 'SET_LOADING', payload: true });
    postMessage(createGetSessionsMessage());
  }, []);

  const setSessionMode = useCallback((modeId: string) => {
    postMessage(createSetSessionModeMessage(modeId));
  }, []);

  const setSessionModel = useCallback((modelId: string) => {
    postMessage(createSetSessionModelMessage(modelId));
  }, []);

  const groupedSessions = groupSessionsByDate(state.sessions);

  const activeSession = state.activeSessionId
    ? (state.sessions.find(s => s.sessionId === state.activeSessionId) ?? null)
    : null;

  return {
    sessions: state.sessions,
    groupedSessions,
    activeSessionId: state.activeSessionId,
    activeSession,
    isPanelOpen: state.isPanelOpen,
    isLoading: state.isLoading,
    isLoadingHistory: state.isLoadingHistory,
    historyUnavailable: state.historyUnavailable,
    settings: state.settings,
    togglePanel,
    closePanel,
    selectSession,
    createSession,
    refreshSessions,
    setSessionMode,
    setSessionModel,
  };
}
