import { useCallback, useEffect, useReducer, useRef } from 'react';
import { onMessage, postMessage, getState, setState } from '../bridge';
import { ChatMessage, MessageRole, MessageStatus } from '../../shared/types';
import {
  createSendMessageMessage,
  createStopGenerationMessage,
  isStreamTokenMessage,
  isGenerationCompleteMessage,
  isGenerationCancelledMessage,
  isChatHistoryMessage,
} from '../../shared/messages';

interface ChatState {
  messages: ChatMessage[];
  isGenerating: boolean;
  currentResponseId: string | null;
  inputValue: string;
  focusedIndex: number | null;
}

type ChatAction =
  | { type: 'ADD_USER_MESSAGE'; payload: ChatMessage }
  | { type: 'START_GENERATION'; payload: { responseId: string } }
  | { type: 'STREAM_TOKEN'; payload: { messageId: string; token: string } }
  | { type: 'COMPLETE_GENERATION'; payload: { messageId: string } }
  | { type: 'CANCEL_GENERATION'; payload: { messageId: string } }
  | { type: 'SET_MESSAGES'; payload: ChatMessage[] }
  | { type: 'SET_INPUT'; payload: string }
  | { type: 'SET_FOCUSED_INDEX'; payload: number | null }
  | { type: 'ADD_ERROR_MESSAGE'; payload: { id: string; content: string } };

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'ADD_USER_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
        inputValue: '',
      };

    case 'START_GENERATION': {
      const assistantMessage: ChatMessage = {
        id: action.payload.responseId,
        role: MessageRole.ASSISTANT,
        content: '',
        timestamp: new Date(),
        status: MessageStatus.STREAMING,
      };
      return {
        ...state,
        messages: [...state.messages, assistantMessage],
        isGenerating: true,
        currentResponseId: action.payload.responseId,
      };
    }

    case 'STREAM_TOKEN':
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.payload.messageId
            ? { ...msg, content: msg.content + action.payload.token }
            : msg
        ),
      };

    case 'COMPLETE_GENERATION':
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.payload.messageId ? { ...msg, status: MessageStatus.COMPLETE } : msg
        ),
        isGenerating: false,
        currentResponseId: null,
      };

    case 'CANCEL_GENERATION':
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.payload.messageId ? { ...msg, status: MessageStatus.CANCELLED } : msg
        ),
        isGenerating: false,
        currentResponseId: null,
      };

    case 'SET_MESSAGES':
      return {
        ...state,
        messages: action.payload,
      };

    case 'SET_INPUT':
      return {
        ...state,
        inputValue: action.payload,
      };

    case 'SET_FOCUSED_INDEX':
      return {
        ...state,
        focusedIndex: action.payload,
      };

    case 'ADD_ERROR_MESSAGE': {
      const errorMessage: ChatMessage = {
        id: action.payload.id,
        role: MessageRole.ERROR,
        content: action.payload.content,
        timestamp: new Date(),
        status: MessageStatus.ERROR,
      };
      return {
        ...state,
        messages: [...state.messages, errorMessage],
        isGenerating: false,
        currentResponseId: null,
      };
    }

    default:
      return state;
  }
}

interface PersistedState {
  inputDraft: string;
}

function getInitialState(): ChatState {
  const persisted = getState<PersistedState>();

  return {
    messages: [],
    isGenerating: false,
    currentResponseId: null,
    inputValue: persisted?.inputDraft ?? '',
    focusedIndex: null,
  };
}

export interface UseChatReturn {
  messages: readonly ChatMessage[];
  isGenerating: boolean;
  inputValue: string;
  setInputValue: (value: string) => void;
  sendMessage: () => void;
  stopGeneration: () => void;
  focusedIndex: number | null;
  setFocusedIndex: (index: number | null) => void;
}

export function useChat(): UseChatReturn {
  const [state, dispatch] = useReducer(chatReducer, null, getInitialState);
  const inputValueRef = useRef(state.inputValue);

  useEffect(() => {
    inputValueRef.current = state.inputValue;
    setState<PersistedState>({ inputDraft: state.inputValue });
  }, [state.inputValue]);

  useEffect(() => {
    const unsubscribe = onMessage(message => {
      if (isStreamTokenMessage(message)) {
        dispatch({
          type: 'STREAM_TOKEN',
          payload: {
            messageId: message.payload.messageId,
            token: message.payload.token,
          },
        });
      } else if (isGenerationCompleteMessage(message)) {
        dispatch({
          type: 'COMPLETE_GENERATION',
          payload: { messageId: message.payload.messageId },
        });
      } else if (isGenerationCancelledMessage(message)) {
        dispatch({
          type: 'CANCEL_GENERATION',
          payload: { messageId: message.payload.messageId },
        });
      } else if (isChatHistoryMessage(message)) {
        dispatch({
          type: 'SET_MESSAGES',
          payload: message.payload.messages as ChatMessage[],
        });
      }
    });

    return unsubscribe;
  }, []);

  const setInputValue = useCallback((value: string) => {
    dispatch({ type: 'SET_INPUT', payload: value });
  }, []);

  const sendMessage = useCallback(() => {
    const content = inputValueRef.current.trim();
    if (!content) return;

    const userMessageId = generateId();
    const responseId = generateId();

    const userMessage: ChatMessage = {
      id: userMessageId,
      role: MessageRole.USER,
      content,
      timestamp: new Date(),
      status: MessageStatus.COMPLETE,
    };

    dispatch({ type: 'ADD_USER_MESSAGE', payload: userMessage });
    dispatch({ type: 'START_GENERATION', payload: { responseId } });

    postMessage(createSendMessageMessage(content, userMessageId));
  }, []);

  const stopGeneration = useCallback(() => {
    postMessage(createStopGenerationMessage());
  }, []);

  const setFocusedIndex = useCallback((index: number | null) => {
    dispatch({ type: 'SET_FOCUSED_INDEX', payload: index });
  }, []);

  return {
    messages: state.messages,
    isGenerating: state.isGenerating,
    inputValue: state.inputValue,
    setInputValue,
    sendMessage,
    stopGeneration,
    focusedIndex: state.focusedIndex,
    setFocusedIndex,
  };
}
