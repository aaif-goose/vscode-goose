/**
 * Session manager for orchestrating session operations.
 * Coordinates between ACP client, session storage, and webview.
 */

import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import { JsonRpcClient } from './jsonRpcClient';
import { SessionStorage } from './sessionStorage';
import { Logger } from './logger';
import {
  SessionEntry,
  AgentCapabilities,
  GroupedSessions,
  groupSessionsByDate,
  generateSessionTitle,
  DEFAULT_CAPABILITIES,
} from '../shared/sessionTypes';
import { ChatMessage, MessageRole, MessageStatus, JsonRpcNotification } from '../shared/types';
import { GooseError, createJsonRpcError } from '../shared/errors';

interface AcpSessionNewResponse {
  readonly sessionId: string;
}

interface AcpSessionLoadResponse {
  readonly success?: boolean;
}

/** ContentBlock types from ACP */
interface AcpTextContent {
  readonly type: 'text';
  readonly text: string;
}

interface AcpResourceLinkContent {
  readonly type: 'resource_link';
  readonly uri: string;
  readonly name: string;
  readonly mimeType?: string;
}

interface AcpEmbeddedResourceContent {
  readonly type: 'resource';
  readonly resource: {
    readonly uri: string;
    readonly text?: string;
    readonly blob?: string;
    readonly mimeType?: string;
  };
}

type AcpContentBlock = AcpTextContent | AcpResourceLinkContent | AcpEmbeddedResourceContent;

interface AcpSessionUpdateParams {
  readonly sessionId: string;
  readonly update: {
    readonly sessionUpdate: string;
    readonly content?: AcpContentBlock;
  };
}

export interface SessionManager {
  initialize(
    client: JsonRpcClient,
    capabilities: AgentCapabilities,
    workingDirectory: string
  ): void;
  createSession(): TE.TaskEither<GooseError, SessionEntry>;
  loadSession(sessionId: string): TE.TaskEither<GooseError, void>;
  getGroupedSessions(): GroupedSessions[];
  getSessions(): readonly SessionEntry[];
  getActiveSession(): SessionEntry | null;
  getActiveSessionId(): string | null;
  updateSessionTitle(sessionId: string, title: string): Promise<void>;
  hasLoadSessionCapability(): boolean;
  hasEmbeddedContextCapability(): boolean;
  onHistoryMessage(callback: (message: ChatMessage) => void): () => void;
  onHistoryComplete(callback: (sessionId: string, messageCount: number) => void): () => void;
  dispose(): void;
}

export function createSessionManager(storage: SessionStorage, logger: Logger): SessionManager {
  let client: JsonRpcClient | null = null;
  let capabilities: AgentCapabilities = DEFAULT_CAPABILITIES;
  let workingDirectory = '';
  const historyMessageCallbacks: ((message: ChatMessage) => void)[] = [];
  const historyCompleteCallbacks: ((sessionId: string, messageCount: number) => void)[] = [];

  const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  };

  const initialize = (
    rpcClient: JsonRpcClient,
    agentCapabilities: AgentCapabilities,
    cwd: string
  ): void => {
    client = rpcClient;
    capabilities = agentCapabilities;
    workingDirectory = cwd;
    logger.info('SessionManager initialized');
  };

  const createSession = (): TE.TaskEither<GooseError, SessionEntry> => {
    if (!client) {
      return TE.left(createJsonRpcError(-32000, 'Client not initialized'));
    }

    const rpcClient = client;

    return pipe(
      rpcClient.request<AcpSessionNewResponse>('session/new', {
        cwd: workingDirectory,
        mcpServers: [],
      }),
      TE.map(response => {
        const session: SessionEntry = {
          sessionId: response.sessionId,
          title: 'New Session',
          cwd: workingDirectory,
          createdAt: new Date().toISOString(),
        };

        storage.addSession(session);
        storage.setActiveSession(session.sessionId);

        logger.info(`Created session: ${session.sessionId}`);
        return session;
      })
    );
  };

  const loadSession = (sessionId: string): TE.TaskEither<GooseError, void> => {
    if (!client) {
      return TE.left(createJsonRpcError(-32000, 'Client not initialized'));
    }

    const session = storage.getSession(sessionId);
    if (!session) {
      return TE.left(createJsonRpcError(-32001, `Session not found: ${sessionId}`));
    }

    if (!capabilities.loadSession) {
      logger.info('loadSession capability not available, switching without history');
      storage.setActiveSession(sessionId);
      return TE.right(undefined);
    }

    const rpcClient = client;
    let messageCount = 0;
    let isLoadingSession = true;

    rpcClient.onNotification((notification: JsonRpcNotification) => {
      if (!isLoadingSession) return;
      if (notification.method !== 'session/update') return;

      const params = notification.params as AcpSessionUpdateParams | undefined;
      if (!params?.update) return;

      const { sessionUpdate, content } = params.update;
      if (!content) return;

      const role = sessionUpdate === 'user_message_chunk' ? MessageRole.USER
        : sessionUpdate === 'agent_message_chunk' ? MessageRole.ASSISTANT
        : null;

      if (!role) return;

      // Handle different content types
      if (content.type === 'text') {
        const msg: ChatMessage = {
          id: generateId(),
          role,
          content: content.text,
          timestamp: undefined,
          status: MessageStatus.COMPLETE,
        };
        historyMessageCallbacks.forEach(cb => cb(msg));
        messageCount++;
      } else if (content.type === 'resource_link') {
        // Resource link - reference without content
        const fileName = content.name || content.uri.split('/').pop() || 'file';
        const filePath = content.uri.replace(/^file:\/\//, '');
        const msg: ChatMessage = {
          id: generateId(),
          role,
          content: '', // No text content
          timestamp: undefined,
          status: MessageStatus.COMPLETE,
          context: [{
            filePath,
            fileName,
          }],
        };
        historyMessageCallbacks.forEach(cb => cb(msg));
        messageCount++;
      } else if (content.type === 'resource') {
        // Embedded resource - has actual content
        const uri = content.resource.uri;
        const filePath = uri.replace(/^file:\/\//, '').split('#')[0];
        const fileName = filePath.split('/').pop() || 'file';
        const fileContent = content.resource.text || '';
        const msg: ChatMessage = {
          id: generateId(),
          role,
          content: '', // No text content, it's in context
          timestamp: undefined,
          status: MessageStatus.COMPLETE,
          context: [{
            filePath,
            fileName,
            content: fileContent,
          }],
        };
        historyMessageCallbacks.forEach(cb => cb(msg));
        messageCount++;
      }
    });

    return pipe(
      rpcClient.request<AcpSessionLoadResponse>('session/load', {
        sessionId,
        cwd: session.cwd,
        mcpServers: [],
      }),
      TE.map(() => {
        isLoadingSession = false;
        storage.setActiveSession(sessionId);
        historyCompleteCallbacks.forEach(cb => cb(sessionId, messageCount));
        logger.info(`Loaded session: ${sessionId} with ${messageCount} messages`);
      }),
      TE.mapLeft(error => {
        isLoadingSession = false;
        logger.error('Failed to load session:', error);
        return error;
      })
    );
  };

  const getGroupedSessions = (): GroupedSessions[] => {
    const sessions = storage.getSessions();
    return groupSessionsByDate(sessions);
  };

  const getSessions = (): readonly SessionEntry[] => {
    return storage.getSessions();
  };

  const getActiveSession = (): SessionEntry | null => {
    const activeId = storage.getActiveSessionId();
    if (!activeId) return null;
    return storage.getSession(activeId) ?? null;
  };

  const getActiveSessionId = (): string | null => {
    return storage.getActiveSessionId();
  };

  const updateSessionTitle = async (sessionId: string, title: string): Promise<void> => {
    const generatedTitle = generateSessionTitle(title);
    await storage.updateSessionTitle(sessionId, generatedTitle);
    logger.debug(`Updated session title: ${sessionId} -> ${generatedTitle}`);
  };

  const hasLoadSessionCapability = (): boolean => {
    return capabilities.loadSession;
  };

  const hasEmbeddedContextCapability = (): boolean => {
    return capabilities.promptCapabilities.embeddedContext;
  };

  const onHistoryMessage = (callback: (message: ChatMessage) => void): (() => void) => {
    historyMessageCallbacks.push(callback);
    return () => {
      const index = historyMessageCallbacks.indexOf(callback);
      if (index > -1) {
        historyMessageCallbacks.splice(index, 1);
      }
    };
  };

  const onHistoryComplete = (
    callback: (sessionId: string, messageCount: number) => void
  ): (() => void) => {
    historyCompleteCallbacks.push(callback);
    return () => {
      const index = historyCompleteCallbacks.indexOf(callback);
      if (index > -1) {
        historyCompleteCallbacks.splice(index, 1);
      }
    };
  };

  const dispose = (): void => {
    client = null;
    historyMessageCallbacks.length = 0;
    historyCompleteCallbacks.length = 0;
    logger.debug('SessionManager disposed');
  };

  return {
    initialize,
    createSession,
    loadSession,
    getGroupedSessions,
    getSessions,
    getActiveSession,
    getActiveSessionId,
    updateSessionTitle,
    hasLoadSessionCapability,
    hasEmbeddedContextCapability,
    onHistoryMessage,
    onHistoryComplete,
    dispose,
  };
}
