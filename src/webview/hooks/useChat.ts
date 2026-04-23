import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { ContextChip } from '../../shared/contextTypes';
import {
  ContextChipData,
  createSendMessageMessage,
  createStopGenerationMessage,
  isChatHistoryMessage,
  isErrorMessage,
  isGenerationCancelledMessage,
  isGenerationCompleteMessage,
  isHistoryMessage,
  isSessionCreatedMessage,
  isStreamTokenMessage,
} from '../../shared/messages';
import { ChatMessage, MessageContext, MessageRole, MessageStatus } from '../../shared/types';
import { getState, onMessage, postMessage, setState } from '../bridge';

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
  | { type: 'ADD_ERROR_MESSAGE'; payload: { id: string; content: string } }
  | { type: 'ADD_HISTORY_MESSAGE'; payload: ChatMessage }
  | { type: 'CLEAR_MESSAGES' };

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
      // Clean up the optimistic assistant placeholder created by
      // START_GENERATION so a failed send renders as a single error row
      // rather than "empty assistant bubble + error". If the assistant had
      // already streamed partial text before the failure, keep the content
      // (marking it COMPLETE so the spinner stops) -- only drop truly empty
      // placeholders.
      const cleaned = state.messages.flatMap(msg => {
        if (msg.role !== MessageRole.ASSISTANT || msg.status !== MessageStatus.STREAMING) {
          return [msg];
        }
        if (msg.content === '') return [];
        return [{ ...msg, status: MessageStatus.COMPLETE }];
      });
      return {
        ...state,
        messages: [...cleaned, errorMessage],
        isGenerating: false,
        currentResponseId: null,
      };
    }

    case 'ADD_HISTORY_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };

    case 'CLEAR_MESSAGES':
      return {
        ...state,
        messages: [],
        isGenerating: false,
        currentResponseId: null,
      };

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
  sendMessage: (chips?: readonly ContextChip[]) => void;
  stopGeneration: () => void;
  focusedIndex: number | null;
  setFocusedIndex: (index: number | null) => void;
  retryMessage: (content: string) => void;
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
      } else if (isHistoryMessage(message)) {
        // Convert timestamp from string (JSON serialized) back to Date
        const msg = message.payload.message;
        dispatch({
          type: 'ADD_HISTORY_MESSAGE',
          payload: {
            ...msg,
            timestamp: typeof msg.timestamp === 'string' ? new Date(msg.timestamp) : msg.timestamp,
          },
        });
      } else if (isSessionCreatedMessage(message)) {
        dispatch({ type: 'CLEAR_MESSAGES' });
      } else if (isErrorMessage(message)) {
        const { title, message: body } = message.payload;
        dispatch({
          type: 'ADD_ERROR_MESSAGE',
          payload: {
            id: generateId(),
            content: body ? `${title}: ${body}` : title,
          },
        });
      }
    });

    return unsubscribe;
  }, []);

  const setInputValue = useCallback((value: string) => {
    dispatch({ type: 'SET_INPUT', payload: value });
  }, []);

  const sendMessage = useCallback((chips?: readonly ContextChip[]) => {
    const content = inputValueRef.current.trim();
    if (!content && (!chips || chips.length === 0)) return;

    const userMessageId = generateId();
    const responseId = generateId();

    // Convert chips to context for display in message
    const context: MessageContext[] | undefined = chips?.map(chip => ({
      filePath: chip.filePath,
      fileName: chip.fileName,
      range: chip.range,
    }));

    const userMessage: ChatMessage = {
      id: userMessageId,
      role: MessageRole.USER,
      content: content || '(context only)',
      timestamp: new Date(),
      status: MessageStatus.COMPLETE,
      context: context && context.length > 0 ? context : undefined,
    };

    dispatch({ type: 'ADD_USER_MESSAGE', payload: userMessage });
    dispatch({ type: 'START_GENERATION', payload: { responseId } });

    // Convert ContextChip to ContextChipData (only what extension needs)
    const chipData: ContextChipData[] | undefined = chips?.map(chip => ({
      filePath: chip.filePath,
      range: chip.range,
    }));

    postMessage(createSendMessageMessage(content, userMessageId, responseId, chipData));
  }, []);

  const stopGeneration = useCallback(() => {
    postMessage(createStopGenerationMessage());
  }, []);

  const setFocusedIndex = useCallback((index: number | null) => {
    dispatch({ type: 'SET_FOCUSED_INDEX', payload: index });
  }, []);

  const retryMessage = useCallback((content: string) => {
    if (!content.trim()) return;

    const userMessageId = generateId();
    const responseId = generateId();

    const userMessage: ChatMessage = {
      id: userMessageId,
      role: MessageRole.USER,
      content: content.trim(),
      timestamp: new Date(),
      status: MessageStatus.COMPLETE,
    };

    dispatch({ type: 'ADD_USER_MESSAGE', payload: userMessage });
    dispatch({ type: 'START_GENERATION', payload: { responseId } });

    postMessage(createSendMessageMessage(content.trim(), userMessageId, responseId));
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
    retryMessage,
  };
}
