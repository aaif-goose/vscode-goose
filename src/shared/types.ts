/**
 * Common types and interfaces shared between extension and webview.
 */

/** Status of the goose subprocess */
export enum ProcessStatus {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  ERROR = 'error',
}

/** Log levels for the logger */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/** Parse log level from string (e.g., from VS Code settings) */
export function parseLogLevel(level: string): LogLevel {
  switch (level.toLowerCase()) {
    case 'debug':
      return LogLevel.DEBUG;
    case 'info':
      return LogLevel.INFO;
    case 'warn':
      return LogLevel.WARN;
    case 'error':
      return LogLevel.ERROR;
    default:
      return LogLevel.INFO;
  }
}

/** Convert log level to string */
export function logLevelToString(level: LogLevel): string {
  switch (level) {
    case LogLevel.DEBUG:
      return 'DEBUG';
    case LogLevel.INFO:
      return 'INFO';
    case LogLevel.WARN:
      return 'WARN';
    case LogLevel.ERROR:
      return 'ERROR';
  }
}

// ============================================================================
// JSON-RPC Types
// ============================================================================

/** JSON-RPC 2.0 request */
export interface JsonRpcRequest {
  readonly jsonrpc: '2.0';
  readonly id: number;
  readonly method: string;
  readonly params?: unknown;
}

/** JSON-RPC 2.0 response */
export interface JsonRpcResponse {
  readonly jsonrpc: '2.0';
  readonly id: number;
  readonly result?: unknown;
  readonly error?: JsonRpcResponseError;
}

/** JSON-RPC 2.0 error object in response */
export interface JsonRpcResponseError {
  readonly code: number;
  readonly message: string;
  readonly data?: unknown;
}

/** JSON-RPC 2.0 notification (no id, no response expected) */
export interface JsonRpcNotification {
  readonly jsonrpc: '2.0';
  readonly method: string;
  readonly params?: unknown;
}

/** Pending request tracking for matching responses to requests */
export interface PendingRequest<T = unknown> {
  readonly id: number;
  readonly method: string;
  readonly resolve: (value: T) => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

// ============================================================================
// Binary Discovery Types
// ============================================================================

/** Configuration for binary discovery */
export interface BinaryDiscoveryConfig {
  readonly userConfiguredPath: string | undefined;
  readonly platform: NodeJS.Platform;
  readonly env: NodeJS.ProcessEnv;
  readonly homeDir: string;
}

// ============================================================================
// Chat UI Types
// ============================================================================

/** Role of a chat message */
export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  ERROR = 'error',
}

/** Status of a chat message */
export enum MessageStatus {
  PENDING = 'pending',
  STREAMING = 'streaming',
  COMPLETE = 'complete',
  CANCELLED = 'cancelled',
  ERROR = 'error',
}

/** File location referenced by a tool call */
export interface ToolCallLocation {
  readonly path: string;
  readonly line?: number | null;
}

/** Structured assistant content parts */
export type ChatContentPart = TextPart | ThinkingPart | ToolCallPart;

export interface TextPart {
  readonly type: 'text';
  readonly text: string;
  readonly streaming?: boolean;
}

export interface ThinkingPart {
  readonly type: 'thinking';
  readonly text: string;
  readonly streaming: boolean;
}

export interface ToolCallPart {
  readonly type: 'tool_call';
  readonly id: string;
  readonly title: string;
  readonly status: 'pending' | 'in_progress' | 'completed' | 'failed';
  readonly kind?: string;
  readonly rawInput?: unknown;
  readonly rawOutput?: unknown;
  readonly contentPreview?: readonly string[];
  readonly locations?: readonly ToolCallLocation[];
}

/** Attached context reference in a message (used for both input and history) */
export interface MessageContext {
  readonly filePath: string;
  readonly fileName: string;
  readonly range?: {
    readonly startLine: number;
    readonly endLine: number;
  };
  readonly content?: string; // File content (present in history, absent in live messages)
}

/** Chat message structure */
export interface ChatMessage {
  readonly id: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly timestamp?: Date; // Optional - undefined for history messages loaded from server
  readonly status: MessageStatus;
  readonly originalContent?: string;
  readonly context?: readonly MessageContext[]; // Attached file/resource references
  readonly contentParts?: readonly ChatContentPart[];
}

/** Chat UI state */
export interface ChatState {
  readonly messages: readonly ChatMessage[];
  readonly isGenerating: boolean;
  readonly currentResponseId: string | null;
  readonly inputDraft: string;
  readonly focusedMessageIndex: number | null;
}
