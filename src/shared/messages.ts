/**
 * Message types for webview-extension communication via postMessage.
 */

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
  messageId: string
): WebviewMessage<WebviewMessageType.SEND_MESSAGE> {
  return {
    type: WebviewMessageType.SEND_MESSAGE,
    payload: { content, messageId },
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
