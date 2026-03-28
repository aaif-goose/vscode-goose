import { useCallback, useEffect, useReducer } from 'react';
import type { ContextChip } from '../../shared/contextTypes';
import {
  ContextChipData,
  createSendMessageMessage,
  createStopGenerationMessage,
  isChatHistoryMessage,
  isGenerationCancelledMessage,
  isGenerationCompleteMessage,
  isHistoryMessage,
  isSessionCreatedMessage,
  isStreamTokenMessage,
  isThinkingDeltaMessage,
  isToolCallStartMessage,
  isToolCallUpdateMessage,
} from '../../shared/messages';
import {
  ChatContentPart,
  ChatMessage,
  MessageContext,
  MessageRole,
  MessageStatus,
  ThinkingPart,
  ToolCallPart,
} from '../../shared/types';
import { onMessage, postMessage } from '../bridge';

interface ChatState {
  messages: ChatMessage[];
  isGenerating: boolean;
  currentResponseId: string | null;
  focusedIndex: number | null;
}

type ChatAction =
  | { type: 'ADD_USER_MESSAGE'; payload: ChatMessage }
  | { type: 'START_GENERATION'; payload: { responseId: string } }
  | { type: 'STREAM_TOKEN'; payload: { messageId: string; token: string } }
  | { type: 'THINKING_DELTA'; payload: { messageId: string; text: string } }
  | {
      type: 'TOOL_CALL_START';
      payload: {
        messageId: string;
        toolCallId: string;
        title: string;
        status: ToolCallPart['status'];
        kind?: string;
        rawInput?: unknown;
        locations?: ToolCallPart['locations'];
      };
    }
  | {
      type: 'TOOL_CALL_UPDATE';
      payload: {
        messageId: string;
        toolCallId: string;
        title?: string;
        status?: ToolCallPart['status'];
        kind?: string;
        rawInput?: unknown;
        rawOutput?: unknown;
        contentPreview?: readonly string[];
        locations?: ToolCallPart['locations'];
      };
    }
  | { type: 'COMPLETE_GENERATION'; payload: { messageId: string } }
  | { type: 'CANCEL_GENERATION'; payload: { messageId: string } }
  | { type: 'SET_MESSAGES'; payload: ChatMessage[] }
  | { type: 'SET_FOCUSED_INDEX'; payload: number | null }
  | { type: 'ADD_ERROR_MESSAGE'; payload: { id: string; content: string } }
  | { type: 'ADD_HISTORY_MESSAGE'; payload: ChatMessage }
  | { type: 'CLEAR_MESSAGES' };

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function appendTextPart(
  parts: readonly ChatContentPart[] | undefined,
  token: string
): ChatContentPart[] {
  const nextParts = [...(parts ?? [])];
  const lastPart = nextParts[nextParts.length - 1];

  if (lastPart?.type === 'text') {
    nextParts[nextParts.length - 1] = {
      ...lastPart,
      text: lastPart.text + token,
      streaming: true,
    };
    return nextParts;
  }

  nextParts.push({
    type: 'text',
    text: token,
    streaming: true,
  });
  return nextParts;
}

function appendThinkingPart(
  parts: readonly ChatContentPart[] | undefined,
  text: string
): ChatContentPart[] {
  const nextParts = [...(parts ?? [])];
  const lastPart = nextParts[nextParts.length - 1];

  if (lastPart?.type === 'thinking') {
    nextParts[nextParts.length - 1] = {
      ...lastPart,
      text: lastPart.text + text,
      streaming: true,
    };
    return nextParts;
  }

  nextParts.push({
    type: 'thinking',
    text,
    streaming: true,
  });
  return nextParts;
}

function upsertToolCallPart(
  parts: readonly ChatContentPart[] | undefined,
  toolCall: {
    id: string;
    title?: string;
    status?: ToolCallPart['status'];
    kind?: string;
    rawInput?: unknown;
    rawOutput?: unknown;
    contentPreview?: readonly string[];
    locations?: ToolCallPart['locations'];
  }
): ChatContentPart[] {
  const nextParts = [...(parts ?? [])];
  const existingIndex = nextParts.findIndex(
    part => part.type === 'tool_call' && part.id === toolCall.id
  );

  if (existingIndex >= 0) {
    const existing = nextParts[existingIndex] as ToolCallPart;
    nextParts[existingIndex] = {
      ...existing,
      title: toolCall.title ?? existing.title,
      status: toolCall.status ?? existing.status,
      kind: toolCall.kind ?? existing.kind,
      rawInput: toolCall.rawInput ?? existing.rawInput,
      rawOutput: toolCall.rawOutput ?? existing.rawOutput,
      contentPreview: toolCall.contentPreview ?? existing.contentPreview,
      locations: toolCall.locations ?? existing.locations,
    };
    return nextParts;
  }

  nextParts.push({
    type: 'tool_call',
    id: toolCall.id,
    title: toolCall.title ?? 'Tool call',
    status: toolCall.status ?? 'pending',
    kind: toolCall.kind,
    rawInput: toolCall.rawInput,
    rawOutput: toolCall.rawOutput,
    contentPreview: toolCall.contentPreview,
    locations: toolCall.locations,
  });
  return nextParts;
}

function finalizeStreamingParts(
  parts: readonly ChatContentPart[] | undefined
): ChatContentPart[] | undefined {
  if (!parts) return parts;
  return parts.map(part => {
    if (part.type === 'text') {
      return { ...part, streaming: false };
    }
    if (part.type === 'thinking') {
      return { ...part, streaming: false };
    }
    return part;
  });
}

function flattenAssistantText(parts: readonly ChatContentPart[] | undefined): string {
  if (!parts) return '';
  return parts
    .filter((part): part is Extract<ChatContentPart, { type: 'text' }> => part.type === 'text')
    .map(part => part.text)
    .join('');
}

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'ADD_USER_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };

    case 'START_GENERATION': {
      const assistantMessage: ChatMessage = {
        id: action.payload.responseId,
        role: MessageRole.ASSISTANT,
        content: '',
        contentParts: [],
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
        messages: state.messages.map(msg => {
          if (msg.id !== action.payload.messageId) return msg;
          const contentParts = appendTextPart(msg.contentParts, action.payload.token);
          return {
            ...msg,
            contentParts,
            content: flattenAssistantText(contentParts),
          };
        }),
      };

    case 'THINKING_DELTA':
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.payload.messageId
            ? {
                ...msg,
                contentParts: appendThinkingPart(msg.contentParts, action.payload.text),
              }
            : msg
        ),
      };

    case 'TOOL_CALL_START':
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.payload.messageId
            ? {
                ...msg,
                contentParts: upsertToolCallPart(msg.contentParts, {
                  id: action.payload.toolCallId,
                  title: action.payload.title,
                  status: action.payload.status,
                  kind: action.payload.kind,
                  rawInput: action.payload.rawInput,
                  locations: action.payload.locations,
                }),
              }
            : msg
        ),
      };

    case 'TOOL_CALL_UPDATE':
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.payload.messageId
            ? {
                ...msg,
                contentParts: upsertToolCallPart(msg.contentParts, {
                  id: action.payload.toolCallId,
                  title: action.payload.title,
                  status: action.payload.status,
                  kind: action.payload.kind,
                  rawInput: action.payload.rawInput,
                  rawOutput: action.payload.rawOutput,
                  contentPreview: action.payload.contentPreview,
                  locations: action.payload.locations,
                }),
              }
            : msg
        ),
      };

    case 'COMPLETE_GENERATION':
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.payload.messageId
            ? {
                ...msg,
                status: MessageStatus.COMPLETE,
                contentParts: finalizeStreamingParts(msg.contentParts),
              }
            : msg
        ),
        isGenerating: false,
        currentResponseId: null,
      };

    case 'CANCEL_GENERATION':
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.payload.messageId
            ? {
                ...msg,
                status: MessageStatus.CANCELLED,
                contentParts: finalizeStreamingParts(msg.contentParts),
              }
            : msg
        ),
        isGenerating: false,
        currentResponseId: null,
      };

    case 'SET_MESSAGES':
      return {
        ...state,
        messages: action.payload,
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

function getInitialState(): ChatState {
  return {
    messages: [],
    isGenerating: false,
    currentResponseId: null,
    focusedIndex: null,
  };
}

export interface UseChatReturn {
  messages: readonly ChatMessage[];
  isGenerating: boolean;
  sendMessage: (content: string, chips?: readonly ContextChip[]) => void;
  stopGeneration: () => void;
  focusedIndex: number | null;
  setFocusedIndex: (index: number | null) => void;
  retryMessage: (content: string) => void;
}

export function useChat(): UseChatReturn {
  const [state, dispatch] = useReducer(chatReducer, null, getInitialState);

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
      } else if (isThinkingDeltaMessage(message)) {
        dispatch({
          type: 'THINKING_DELTA',
          payload: {
            messageId: message.payload.messageId,
            text: message.payload.text,
          },
        });
      } else if (isToolCallStartMessage(message)) {
        dispatch({
          type: 'TOOL_CALL_START',
          payload: {
            messageId: message.payload.messageId,
            toolCallId: message.payload.toolCallId,
            title: message.payload.title,
            status: message.payload.status,
            kind: message.payload.kind,
            rawInput: message.payload.rawInput,
            locations: message.payload.locations,
          },
        });
      } else if (isToolCallUpdateMessage(message)) {
        dispatch({
          type: 'TOOL_CALL_UPDATE',
          payload: {
            messageId: message.payload.messageId,
            toolCallId: message.payload.toolCallId,
            title: message.payload.title,
            status: message.payload.status,
            kind: message.payload.kind,
            rawInput: message.payload.rawInput,
            rawOutput: message.payload.rawOutput,
            contentPreview: message.payload.contentPreview,
            locations: message.payload.locations,
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
      }
    });

    return unsubscribe;
  }, []);

  const sendMessage = useCallback((content: string, chips?: readonly ContextChip[]) => {
    const trimmedContent = content.trim();
    if (!trimmedContent && (!chips || chips.length === 0)) return;

    const userMessageId = generateId();
    const responseId = generateId();

    const context: MessageContext[] | undefined = chips?.map(chip => ({
      filePath: chip.filePath,
      fileName: chip.fileName,
      range: chip.range,
    }));

    const userMessage: ChatMessage = {
      id: userMessageId,
      role: MessageRole.USER,
      content: trimmedContent || '(context only)',
      timestamp: new Date(),
      status: MessageStatus.COMPLETE,
      context: context && context.length > 0 ? context : undefined,
    };

    dispatch({ type: 'ADD_USER_MESSAGE', payload: userMessage });
    dispatch({ type: 'START_GENERATION', payload: { responseId } });

    const chipData: ContextChipData[] | undefined = chips?.map(chip => ({
      filePath: chip.filePath,
      range: chip.range,
    }));

    postMessage(createSendMessageMessage(trimmedContent, userMessageId, responseId, chipData));
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
    sendMessage,
    stopGeneration,
    focusedIndex: state.focusedIndex,
    setFocusedIndex,
    retryMessage,
  };
}
