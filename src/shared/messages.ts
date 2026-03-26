/**
 * Message types for webview-extension communication via postMessage.
 */

import { ContextChip, FileSearchResult } from './contextTypes';
import { SessionEntry, SessionSettingsState } from './sessionTypes';
import { ChatMessage, ProcessStatus } from './types';

/** Types of messages that can be sent between webview and extension */
export enum WebviewMessageType {
  /** Webview signals it has finished loading and is ready to receive messages */
  WEBVIEW_READY = 'WEBVIEW_READY',
  /** Extension sends subprocess status update to webview */
  STATUS_UPDATE = 'STATUS_UPDATE',
  /** Webview requests current status from extension */
  GET_STATUS = 'GET_STATUS',
  /** Extension sends error to webview for display */
  ERROR = 'ERROR',
  /** Webview sends a chat message to extension */
  SEND_MESSAGE = 'SEND_MESSAGE',
  /** Extension streams a response token to webview */
  STREAM_TOKEN = 'STREAM_TOKEN',
  /** Extension signals generation is complete */
  GENERATION_COMPLETE = 'GENERATION_COMPLETE',
  /** Webview requests to stop generation */
  STOP_GENERATION = 'STOP_GENERATION',
  /** Extension signals generation was cancelled */
  GENERATION_CANCELLED = 'GENERATION_CANCELLED',
  /** Extension sends chat history to webview */
  CHAT_HISTORY = 'CHAT_HISTORY',
  /** Webview requests to open an external link in browser */
  OPEN_EXTERNAL_LINK = 'OPEN_EXTERNAL_LINK',

  // Session Management Messages
  /** Webview requests to create a new session */
  CREATE_SESSION = 'CREATE_SESSION',
  /** Extension confirms session created */
  SESSION_CREATED = 'SESSION_CREATED',
  /** Webview requests session list */
  GET_SESSIONS = 'GET_SESSIONS',
  /** Extension sends session list */
  SESSIONS_LIST = 'SESSIONS_LIST',
  /** Webview requests to switch session */
  SELECT_SESSION = 'SELECT_SESSION',
  /** Extension confirms session loaded */
  SESSION_LOADED = 'SESSION_LOADED',
  /** Extension sends history message during replay */
  HISTORY_MESSAGE = 'HISTORY_MESSAGE',
  /** Extension signals history replay complete */
  HISTORY_COMPLETE = 'HISTORY_COMPLETE',

  // Version Status Messages
  /** Extension sends version compatibility status to webview */
  VERSION_STATUS = 'VERSION_STATUS',

  // Context Chip Messages
  /** Extension adds a context chip to the input */
  ADD_CONTEXT_CHIP = 'ADD_CONTEXT_CHIP',
  /** Webview requests file search */
  FILE_SEARCH = 'FILE_SEARCH',
  /** Extension returns file search results */
  SEARCH_RESULTS = 'SEARCH_RESULTS',
  /** Extension requests focus on chat input */
  FOCUS_CHAT_INPUT = 'FOCUS_CHAT_INPUT',
  /** Extension sends active session settings to webview */
  SESSION_SETTINGS = 'SESSION_SETTINGS',
  /** Webview requests changing the active session mode */
  SET_SESSION_MODE = 'SET_SESSION_MODE',
  /** Webview requests changing the active session model */
  SET_SESSION_MODEL = 'SET_SESSION_MODEL',
}

// ============================================================================
// Message Payloads
// ============================================================================

/** Payload for WEBVIEW_READY message */
export interface WebviewReadyPayload {
  readonly version: string;
}

/** Payload for STATUS_UPDATE message */
export interface StatusUpdatePayload {
  readonly status: ProcessStatus;
  readonly message?: string;
}

/** Payload for GET_STATUS message (empty payload) */
export type GetStatusPayload = Record<string, never>;

/** Payload for ERROR message */
export interface ErrorPayload {
  readonly title: string;
  readonly message: string;
  readonly action?: {
    readonly label: string;
    readonly command: string;
  };
}

/** Payload for SEND_MESSAGE message */
export interface SendMessagePayload {
  readonly content: string;
  readonly messageId: string;
  readonly responseId: string;
  readonly contextChips?: readonly ContextChipData[];
}

/** Context chip data sent with messages (subset of ContextChip for extension) */
export interface ContextChipData {
  readonly filePath: string;
  readonly range?: {
    readonly startLine: number;
    readonly endLine: number;
  };
}

/** Payload for STREAM_TOKEN message */
export interface StreamTokenPayload {
  readonly messageId: string;
  readonly token: string;
  readonly done: boolean;
}

/** Payload for GENERATION_COMPLETE message */
export interface GenerationCompletePayload {
  readonly messageId: string;
}

/** Payload for STOP_GENERATION message (empty payload) */
export type StopGenerationPayload = Record<string, never>;

/** Payload for GENERATION_CANCELLED message */
export interface GenerationCancelledPayload {
  readonly messageId: string;
}

/** Payload for CHAT_HISTORY message */
export interface ChatHistoryPayload {
  readonly messages: readonly ChatMessage[];
}

/** Payload for OPEN_EXTERNAL_LINK message */
export interface OpenExternalLinkPayload {
  readonly url: string;
}

// Session Management Payloads

/** Payload for CREATE_SESSION message */
export interface CreateSessionPayload {
  readonly workingDirectory?: string;
}

/** Payload for SESSION_CREATED message */
export interface SessionCreatedPayload {
  readonly session: SessionEntry;
}

/** Payload for GET_SESSIONS message (empty payload) */
export type GetSessionsPayload = Record<string, never>;

/** Payload for SESSIONS_LIST message */
export interface SessionsListPayload {
  readonly sessions: readonly SessionEntry[];
  readonly activeSessionId: string | null;
}

/** Payload for SELECT_SESSION message */
export interface SelectSessionPayload {
  readonly sessionId: string;
}

/** Payload for SESSION_LOADED message */
export interface SessionLoadedPayload {
  readonly sessionId: string;
  readonly historyUnavailable?: boolean;
}

/** Payload for HISTORY_MESSAGE message */
export interface HistoryMessagePayload {
  readonly message: ChatMessage;
  readonly isReplay: true;
}

/** Payload for HISTORY_COMPLETE message */
export interface HistoryCompletePayload {
  readonly sessionId: string;
  readonly messageCount: number;
}

// Version Status Payloads

/** Payload for VERSION_STATUS message */
export interface VersionStatusPayload {
  readonly status: 'blocked_missing' | 'blocked_outdated' | 'compatible';
  readonly detectedVersion?: string;
  readonly minimumVersion: string;
  readonly installUrl?: string;
  readonly updateUrl?: string;
}

// Context Chip Payloads

/** Payload for ADD_CONTEXT_CHIP message */
export interface AddContextChipPayload {
  readonly chip: ContextChip;
}

/** Payload for FILE_SEARCH message */
export interface FileSearchPayload {
  readonly query: string;
}

/** Payload for SEARCH_RESULTS message */
export interface SearchResultsPayload {
  readonly results: readonly FileSearchResult[];
}

/** Payload for FOCUS_CHAT_INPUT message (empty) */
export type FocusChatInputPayload = Record<string, never>;

/** Payload for SESSION_SETTINGS message */
export interface SessionSettingsPayload {
  readonly settings: SessionSettingsState;
}

/** Payload for SET_SESSION_MODE message */
export interface SetSessionModePayload {
  readonly modeId: string;
}

/** Payload for SET_SESSION_MODEL message */
export interface SetSessionModelPayload {
  readonly modelId: string;
}

// ============================================================================
// Message Type Mapping
// ============================================================================

/** Maps message types to their payload types */
export interface WebviewMessagePayloads {
  [WebviewMessageType.WEBVIEW_READY]: WebviewReadyPayload;
  [WebviewMessageType.STATUS_UPDATE]: StatusUpdatePayload;
  [WebviewMessageType.GET_STATUS]: GetStatusPayload;
  [WebviewMessageType.ERROR]: ErrorPayload;
  [WebviewMessageType.SEND_MESSAGE]: SendMessagePayload;
  [WebviewMessageType.STREAM_TOKEN]: StreamTokenPayload;
  [WebviewMessageType.GENERATION_COMPLETE]: GenerationCompletePayload;
  [WebviewMessageType.STOP_GENERATION]: StopGenerationPayload;
  [WebviewMessageType.GENERATION_CANCELLED]: GenerationCancelledPayload;
  [WebviewMessageType.CHAT_HISTORY]: ChatHistoryPayload;
  [WebviewMessageType.OPEN_EXTERNAL_LINK]: OpenExternalLinkPayload;
  // Session Management
  [WebviewMessageType.CREATE_SESSION]: CreateSessionPayload;
  [WebviewMessageType.SESSION_CREATED]: SessionCreatedPayload;
  [WebviewMessageType.GET_SESSIONS]: GetSessionsPayload;
  [WebviewMessageType.SESSIONS_LIST]: SessionsListPayload;
  [WebviewMessageType.SELECT_SESSION]: SelectSessionPayload;
  [WebviewMessageType.SESSION_LOADED]: SessionLoadedPayload;
  [WebviewMessageType.HISTORY_MESSAGE]: HistoryMessagePayload;
  [WebviewMessageType.HISTORY_COMPLETE]: HistoryCompletePayload;
  // Version Status
  [WebviewMessageType.VERSION_STATUS]: VersionStatusPayload;
  // Context Chips
  [WebviewMessageType.ADD_CONTEXT_CHIP]: AddContextChipPayload;
  [WebviewMessageType.FILE_SEARCH]: FileSearchPayload;
  [WebviewMessageType.SEARCH_RESULTS]: SearchResultsPayload;
  [WebviewMessageType.FOCUS_CHAT_INPUT]: FocusChatInputPayload;
  [WebviewMessageType.SESSION_SETTINGS]: SessionSettingsPayload;
  [WebviewMessageType.SET_SESSION_MODE]: SetSessionModePayload;
  [WebviewMessageType.SET_SESSION_MODEL]: SetSessionModelPayload;
}

/** Generic webview message with typed payload */
export interface WebviewMessage<T extends WebviewMessageType> {
  readonly type: T;
  readonly payload: WebviewMessagePayloads[T];
}

/** Union of all possible webview messages */
export type AnyWebviewMessage = {
  [K in WebviewMessageType]: WebviewMessage<K>;
}[WebviewMessageType];

// ============================================================================
// Message Factory Functions
// ============================================================================

/** Create a WEBVIEW_READY message */
export function createWebviewReadyMessage(
  version: string
): WebviewMessage<WebviewMessageType.WEBVIEW_READY> {
  return {
    type: WebviewMessageType.WEBVIEW_READY,
    payload: { version },
  };
}

/** Create a STATUS_UPDATE message */
export function createStatusUpdateMessage(
  status: ProcessStatus,
  message?: string
): WebviewMessage<WebviewMessageType.STATUS_UPDATE> {
  return {
    type: WebviewMessageType.STATUS_UPDATE,
    payload: { status, message },
  };
}

/** Create a GET_STATUS message */
export function createGetStatusMessage(): WebviewMessage<WebviewMessageType.GET_STATUS> {
  return {
    type: WebviewMessageType.GET_STATUS,
    payload: {},
  };
}

/** Create an ERROR message */
export function createErrorMessage(
  title: string,
  message: string,
  action?: { label: string; command: string }
): WebviewMessage<WebviewMessageType.ERROR> {
  return {
    type: WebviewMessageType.ERROR,
    payload: { title, message, action },
  };
}

/** Create a SEND_MESSAGE message */
export function createSendMessageMessage(
  content: string,
  messageId: string,
  responseId: string,
  contextChips?: readonly ContextChipData[]
): WebviewMessage<WebviewMessageType.SEND_MESSAGE> {
  return {
    type: WebviewMessageType.SEND_MESSAGE,
    payload: {
      content,
      messageId,
      responseId,
      ...(contextChips && contextChips.length > 0 && { contextChips }),
    },
  };
}

/** Create a STREAM_TOKEN message */
export function createStreamTokenMessage(
  messageId: string,
  token: string,
  done: boolean
): WebviewMessage<WebviewMessageType.STREAM_TOKEN> {
  return {
    type: WebviewMessageType.STREAM_TOKEN,
    payload: { messageId, token, done },
  };
}

/** Create a GENERATION_COMPLETE message */
export function createGenerationCompleteMessage(
  messageId: string
): WebviewMessage<WebviewMessageType.GENERATION_COMPLETE> {
  return {
    type: WebviewMessageType.GENERATION_COMPLETE,
    payload: { messageId },
  };
}

/** Create a STOP_GENERATION message */
export function createStopGenerationMessage(): WebviewMessage<WebviewMessageType.STOP_GENERATION> {
  return {
    type: WebviewMessageType.STOP_GENERATION,
    payload: {},
  };
}

/** Create a GENERATION_CANCELLED message */
export function createGenerationCancelledMessage(
  messageId: string
): WebviewMessage<WebviewMessageType.GENERATION_CANCELLED> {
  return {
    type: WebviewMessageType.GENERATION_CANCELLED,
    payload: { messageId },
  };
}

/** Create a CHAT_HISTORY message */
export function createChatHistoryMessage(
  messages: readonly ChatMessage[]
): WebviewMessage<WebviewMessageType.CHAT_HISTORY> {
  return {
    type: WebviewMessageType.CHAT_HISTORY,
    payload: { messages },
  };
}

/** Create an OPEN_EXTERNAL_LINK message */
export function createOpenExternalLinkMessage(
  url: string
): WebviewMessage<WebviewMessageType.OPEN_EXTERNAL_LINK> {
  return {
    type: WebviewMessageType.OPEN_EXTERNAL_LINK,
    payload: { url },
  };
}

// Session Management Factory Functions

/** Create a CREATE_SESSION message */
export function createCreateSessionMessage(
  workingDirectory?: string
): WebviewMessage<WebviewMessageType.CREATE_SESSION> {
  return {
    type: WebviewMessageType.CREATE_SESSION,
    payload: { workingDirectory },
  };
}

/** Create a SESSION_CREATED message */
export function createSessionCreatedMessage(
  session: SessionEntry
): WebviewMessage<WebviewMessageType.SESSION_CREATED> {
  return {
    type: WebviewMessageType.SESSION_CREATED,
    payload: { session },
  };
}

/** Create a GET_SESSIONS message */
export function createGetSessionsMessage(): WebviewMessage<WebviewMessageType.GET_SESSIONS> {
  return {
    type: WebviewMessageType.GET_SESSIONS,
    payload: {},
  };
}

/** Create a SESSIONS_LIST message */
export function createSessionsListMessage(
  sessions: readonly SessionEntry[],
  activeSessionId: string | null
): WebviewMessage<WebviewMessageType.SESSIONS_LIST> {
  return {
    type: WebviewMessageType.SESSIONS_LIST,
    payload: { sessions, activeSessionId },
  };
}

/** Create a SELECT_SESSION message */
export function createSelectSessionMessage(
  sessionId: string
): WebviewMessage<WebviewMessageType.SELECT_SESSION> {
  return {
    type: WebviewMessageType.SELECT_SESSION,
    payload: { sessionId },
  };
}

/** Create a SESSION_LOADED message */
export function createSessionLoadedMessage(
  sessionId: string,
  historyUnavailable?: boolean
): WebviewMessage<WebviewMessageType.SESSION_LOADED> {
  return {
    type: WebviewMessageType.SESSION_LOADED,
    payload: { sessionId, historyUnavailable },
  };
}

/** Create a HISTORY_MESSAGE message */
export function createHistoryMessage(
  message: ChatMessage
): WebviewMessage<WebviewMessageType.HISTORY_MESSAGE> {
  return {
    type: WebviewMessageType.HISTORY_MESSAGE,
    payload: { message, isReplay: true },
  };
}

/** Create a HISTORY_COMPLETE message */
export function createHistoryCompleteMessage(
  sessionId: string,
  messageCount: number
): WebviewMessage<WebviewMessageType.HISTORY_COMPLETE> {
  return {
    type: WebviewMessageType.HISTORY_COMPLETE,
    payload: { sessionId, messageCount },
  };
}

// Version Status Factory Functions

/** Create a VERSION_STATUS message */
export function createVersionStatusMessage(
  status: VersionStatusPayload['status'],
  minimumVersion: string,
  options?: {
    detectedVersion?: string;
    installUrl?: string;
    updateUrl?: string;
  }
): WebviewMessage<WebviewMessageType.VERSION_STATUS> {
  return {
    type: WebviewMessageType.VERSION_STATUS,
    payload: {
      status,
      minimumVersion,
      detectedVersion: options?.detectedVersion,
      installUrl: options?.installUrl,
      updateUrl: options?.updateUrl,
    },
  };
}

// Context Chip Factory Functions

/** Create an ADD_CONTEXT_CHIP message */
export function createAddContextChipMessage(
  chip: ContextChip
): WebviewMessage<WebviewMessageType.ADD_CONTEXT_CHIP> {
  return {
    type: WebviewMessageType.ADD_CONTEXT_CHIP,
    payload: { chip },
  };
}

/** Create a FILE_SEARCH message */
export function createFileSearchMessage(
  query: string
): WebviewMessage<WebviewMessageType.FILE_SEARCH> {
  return {
    type: WebviewMessageType.FILE_SEARCH,
    payload: { query },
  };
}

/** Create a SEARCH_RESULTS message */
export function createSearchResultsMessage(
  results: readonly FileSearchResult[]
): WebviewMessage<WebviewMessageType.SEARCH_RESULTS> {
  return {
    type: WebviewMessageType.SEARCH_RESULTS,
    payload: { results },
  };
}

/** Create a FOCUS_CHAT_INPUT message */
export function createFocusChatInputMessage(): WebviewMessage<WebviewMessageType.FOCUS_CHAT_INPUT> {
  return {
    type: WebviewMessageType.FOCUS_CHAT_INPUT,
    payload: {},
  };
}

/** Create a SESSION_SETTINGS message */
export function createSessionSettingsMessage(
  settings: SessionSettingsState
): WebviewMessage<WebviewMessageType.SESSION_SETTINGS> {
  return {
    type: WebviewMessageType.SESSION_SETTINGS,
    payload: { settings },
  };
}

/** Create a SET_SESSION_MODE message */
export function createSetSessionModeMessage(
  modeId: string
): WebviewMessage<WebviewMessageType.SET_SESSION_MODE> {
  return {
    type: WebviewMessageType.SET_SESSION_MODE,
    payload: { modeId },
  };
}

/** Create a SET_SESSION_MODEL message */
export function createSetSessionModelMessage(
  modelId: string
): WebviewMessage<WebviewMessageType.SET_SESSION_MODEL> {
  return {
    type: WebviewMessageType.SET_SESSION_MODEL,
    payload: { modelId },
  };
}

// ============================================================================
// Type Guards
// ============================================================================

/** Check if a message is of a specific type */
export function isWebviewMessage<T extends WebviewMessageType>(
  message: unknown,
  type: T
): message is WebviewMessage<T> {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    (message as { type: unknown }).type === type
  );
}

/** Check if message is WEBVIEW_READY */
export function isWebviewReadyMessage(
  message: unknown
): message is WebviewMessage<WebviewMessageType.WEBVIEW_READY> {
  return isWebviewMessage(message, WebviewMessageType.WEBVIEW_READY);
}

/** Check if message is STATUS_UPDATE */
export function isStatusUpdateMessage(
  message: unknown
): message is WebviewMessage<WebviewMessageType.STATUS_UPDATE> {
  return isWebviewMessage(message, WebviewMessageType.STATUS_UPDATE);
}

/** Check if message is GET_STATUS */
export function isGetStatusMessage(
  message: unknown
): message is WebviewMessage<WebviewMessageType.GET_STATUS> {
  return isWebviewMessage(message, WebviewMessageType.GET_STATUS);
}

/** Check if message is ERROR */
export function isErrorMessage(
  message: unknown
): message is WebviewMessage<WebviewMessageType.ERROR> {
  return isWebviewMessage(message, WebviewMessageType.ERROR);
}

/** Check if message is SEND_MESSAGE */
export function isSendMessageMessage(
  message: unknown
): message is WebviewMessage<WebviewMessageType.SEND_MESSAGE> {
  return isWebviewMessage(message, WebviewMessageType.SEND_MESSAGE);
}

/** Check if message is STREAM_TOKEN */
export function isStreamTokenMessage(
  message: unknown
): message is WebviewMessage<WebviewMessageType.STREAM_TOKEN> {
  return isWebviewMessage(message, WebviewMessageType.STREAM_TOKEN);
}

/** Check if message is GENERATION_COMPLETE */
export function isGenerationCompleteMessage(
  message: unknown
): message is WebviewMessage<WebviewMessageType.GENERATION_COMPLETE> {
  return isWebviewMessage(message, WebviewMessageType.GENERATION_COMPLETE);
}

/** Check if message is STOP_GENERATION */
export function isStopGenerationMessage(
  message: unknown
): message is WebviewMessage<WebviewMessageType.STOP_GENERATION> {
  return isWebviewMessage(message, WebviewMessageType.STOP_GENERATION);
}

/** Check if message is GENERATION_CANCELLED */
export function isGenerationCancelledMessage(
  message: unknown
): message is WebviewMessage<WebviewMessageType.GENERATION_CANCELLED> {
  return isWebviewMessage(message, WebviewMessageType.GENERATION_CANCELLED);
}

/** Check if message is CHAT_HISTORY */
export function isChatHistoryMessage(
  message: unknown
): message is WebviewMessage<WebviewMessageType.CHAT_HISTORY> {
  return isWebviewMessage(message, WebviewMessageType.CHAT_HISTORY);
}

/** Check if message is OPEN_EXTERNAL_LINK */
export function isOpenExternalLinkMessage(
  message: unknown
): message is WebviewMessage<WebviewMessageType.OPEN_EXTERNAL_LINK> {
  return isWebviewMessage(message, WebviewMessageType.OPEN_EXTERNAL_LINK);
}

// Session Management Type Guards

/** Check if message is CREATE_SESSION */
export function isCreateSessionMessage(
  message: unknown
): message is WebviewMessage<WebviewMessageType.CREATE_SESSION> {
  return isWebviewMessage(message, WebviewMessageType.CREATE_SESSION);
}

/** Check if message is SESSION_CREATED */
export function isSessionCreatedMessage(
  message: unknown
): message is WebviewMessage<WebviewMessageType.SESSION_CREATED> {
  return isWebviewMessage(message, WebviewMessageType.SESSION_CREATED);
}

/** Check if message is GET_SESSIONS */
export function isGetSessionsMessage(
  message: unknown
): message is WebviewMessage<WebviewMessageType.GET_SESSIONS> {
  return isWebviewMessage(message, WebviewMessageType.GET_SESSIONS);
}

/** Check if message is SESSIONS_LIST */
export function isSessionsListMessage(
  message: unknown
): message is WebviewMessage<WebviewMessageType.SESSIONS_LIST> {
  return isWebviewMessage(message, WebviewMessageType.SESSIONS_LIST);
}

/** Check if message is SELECT_SESSION */
export function isSelectSessionMessage(
  message: unknown
): message is WebviewMessage<WebviewMessageType.SELECT_SESSION> {
  return isWebviewMessage(message, WebviewMessageType.SELECT_SESSION);
}

/** Check if message is SESSION_LOADED */
export function isSessionLoadedMessage(
  message: unknown
): message is WebviewMessage<WebviewMessageType.SESSION_LOADED> {
  return isWebviewMessage(message, WebviewMessageType.SESSION_LOADED);
}

/** Check if message is HISTORY_MESSAGE */
export function isHistoryMessage(
  message: unknown
): message is WebviewMessage<WebviewMessageType.HISTORY_MESSAGE> {
  return isWebviewMessage(message, WebviewMessageType.HISTORY_MESSAGE);
}

/** Check if message is HISTORY_COMPLETE */
export function isHistoryCompleteMessage(
  message: unknown
): message is WebviewMessage<WebviewMessageType.HISTORY_COMPLETE> {
  return isWebviewMessage(message, WebviewMessageType.HISTORY_COMPLETE);
}

// Version Status Type Guards

/** Check if message is VERSION_STATUS */
export function isVersionStatusMessage(
  message: unknown
): message is WebviewMessage<WebviewMessageType.VERSION_STATUS> {
  return isWebviewMessage(message, WebviewMessageType.VERSION_STATUS);
}

// Context Chip Type Guards

/** Check if message is ADD_CONTEXT_CHIP */
export function isAddContextChipMessage(
  message: unknown
): message is WebviewMessage<WebviewMessageType.ADD_CONTEXT_CHIP> {
  return isWebviewMessage(message, WebviewMessageType.ADD_CONTEXT_CHIP);
}

/** Check if message is FILE_SEARCH */
export function isFileSearchMessage(
  message: unknown
): message is WebviewMessage<WebviewMessageType.FILE_SEARCH> {
  return isWebviewMessage(message, WebviewMessageType.FILE_SEARCH);
}

/** Check if message is SEARCH_RESULTS */
export function isSearchResultsMessage(
  message: unknown
): message is WebviewMessage<WebviewMessageType.SEARCH_RESULTS> {
  return isWebviewMessage(message, WebviewMessageType.SEARCH_RESULTS);
}

/** Check if message is FOCUS_CHAT_INPUT */
export function isFocusChatInputMessage(
  message: unknown
): message is WebviewMessage<WebviewMessageType.FOCUS_CHAT_INPUT> {
  return isWebviewMessage(message, WebviewMessageType.FOCUS_CHAT_INPUT);
}

/** Check if message is SESSION_SETTINGS */
export function isSessionSettingsMessage(
  message: unknown
): message is WebviewMessage<WebviewMessageType.SESSION_SETTINGS> {
  return isWebviewMessage(message, WebviewMessageType.SESSION_SETTINGS);
}

/** Check if message is SET_SESSION_MODE */
export function isSetSessionModeMessage(
  message: unknown
): message is WebviewMessage<WebviewMessageType.SET_SESSION_MODE> {
  return isWebviewMessage(message, WebviewMessageType.SET_SESSION_MODE);
}

/** Check if message is SET_SESSION_MODEL */
export function isSetSessionModelMessage(
  message: unknown
): message is WebviewMessage<WebviewMessageType.SET_SESSION_MODEL> {
  return isWebviewMessage(message, WebviewMessageType.SET_SESSION_MODEL);
}
