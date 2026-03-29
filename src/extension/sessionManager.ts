/**
 * Session manager for orchestrating session operations.
 * Coordinates between ACP client, session storage, and webview.
 */

import {
  AGENT_METHODS,
  type ConfigOptionUpdate,
  type ContentBlock,
  type CurrentModeUpdate,
  type ListSessionsResponse,
  type LoadSessionResponse,
  type NewSessionResponse,
  type SessionConfigOption,
  type SessionConfigSelectGroup,
  type SessionConfigSelectOption,
  type SessionInfo,
  type SessionModelState,
  type SessionModeState,
  type SessionNotification,
} from '@agentclientprotocol/sdk';
import { pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { createJsonRpcError, GooseError } from '../shared/errors';
import {
  AgentCapabilities,
  DEFAULT_CAPABILITIES,
  EMPTY_SESSION_SETTINGS,
  GroupedSessions,
  groupSessionsByDate,
  SessionEntry,
  SessionSelectSetting,
  SessionSettingOption,
  SessionSettingsState,
} from '../shared/sessionTypes';
import { ChatMessage, JsonRpcNotification, MessageRole, MessageStatus } from '../shared/types';
import { JsonRpcClient } from './jsonRpcClient';
import { Logger } from './logger';
import { SessionStorage } from './sessionStorage';

type SelectConfigOption = Extract<SessionConfigOption, { type: 'select' }>;
type StreamContent = Extract<ContentBlock, { type: 'text' | 'resource_link' | 'resource' }>;

export interface SessionManager {
  initialize(
    client: JsonRpcClient,
    capabilities: AgentCapabilities,
    workingDirectory: string,
    additionalDirectories: readonly string[]
  ): void;
  createSession(): TE.TaskEither<GooseError, SessionEntry>;
  listSessions(): TE.TaskEither<GooseError, readonly SessionEntry[]>;
  loadSession(sessionId: string): TE.TaskEither<GooseError, void>;
  getGroupedSessions(): GroupedSessions[];
  getSessions(): readonly SessionEntry[];
  getActiveSession(): SessionEntry | null;
  getActiveSessionId(): string | null;
  getSessionSettings(): SessionSettingsState;
  setSessionMode(modeId: string): TE.TaskEither<GooseError, void>;
  setSessionModel(modelId: string): TE.TaskEither<GooseError, void>;
  hasLoadSessionCapability(): boolean;
  hasListSessionsCapability(): boolean;
  hasAdditionalDirectoriesCapability(): boolean;
  hasEmbeddedContextCapability(): boolean;
  onHistoryMessage(callback: (message: ChatMessage) => void): () => void;
  onHistoryComplete(callback: (sessionId: string, messageCount: number) => void): () => void;
  onSettingsChange(callback: (settings: SessionSettingsState) => void): () => void;
  dispose(): void;
}

export function createSessionManager(storage: SessionStorage, logger: Logger): SessionManager {
  let client: JsonRpcClient | null = null;
  let capabilities: AgentCapabilities = DEFAULT_CAPABILITIES;
  let workingDirectory = '';
  let additionalDirectories: readonly string[] = [];
  let sessions: SessionEntry[] = [];
  let sessionSettings: SessionSettingsState = EMPTY_SESSION_SETTINGS;
  let replayState: {
    sessionId: string;
    messageCount: number;
    isLoading: boolean;
  } | null = null;
  const historyMessageCallbacks: ((message: ChatMessage) => void)[] = [];
  const historyCompleteCallbacks: ((sessionId: string, messageCount: number) => void)[] = [];
  const settingsChangeCallbacks: ((settings: SessionSettingsState) => void)[] = [];

  const isSelectConfigOption = (option: SessionConfigOption): option is SelectConfigOption => {
    return option.type === 'select';
  };

  const getStreamContent = (update: SessionNotification['update']): StreamContent | null => {
    if (!('content' in update) || Array.isArray(update.content)) {
      return null;
    }
    return update.content as StreamContent;
  };

  const flattenOptions = (
    options: readonly SessionConfigSelectOption[] | readonly SessionConfigSelectGroup[]
  ): SessionSettingOption[] => {
    if (options.length === 0) return [];
    if ('group' in options[0]) {
      return (options as readonly SessionConfigSelectGroup[]).flatMap(group =>
        group.options.map(option => ({
          value: option.value,
          name: option.name,
          description: option.description ?? undefined,
        }))
      );
    }
    return (options as readonly SessionConfigSelectOption[]).map(option => ({
      value: option.value,
      name: option.name,
      description: option.description ?? undefined,
    }));
  };

  const normalizeSettings = (
    modes?: SessionModeState | null,
    models?: SessionModelState | null,
    configOptions?: readonly SessionConfigOption[] | null
  ): SessionSettingsState => {
    const mode: SessionSelectSetting | null =
      modes && modes.availableModes.length > 0
        ? {
            id: 'session-mode',
            label: 'Mode',
            category: 'mode',
            currentValue: modes.currentModeId,
            options: modes.availableModes.map(option => ({
              value: option.id,
              name: option.name,
              description: option.description ?? undefined,
            })),
          }
        : null;

    const configModel = configOptions?.find(
      (option): option is SelectConfigOption =>
        isSelectConfigOption(option) && option.category === 'model'
    );

    const model: SessionSelectSetting | null = models
      ? {
          id: 'session-model',
          label: 'Model',
          category: 'model',
          currentValue: models.currentModelId,
          options: models.availableModels.map(option => ({
            value: option.modelId,
            name: option.name,
            description: option.description ?? undefined,
          })),
        }
      : configModel
        ? {
            id: configModel.id,
            label: configModel.name,
            category: 'model',
            currentValue: configModel.currentValue,
            options: flattenOptions(configModel.options),
            description: configModel.description ?? undefined,
          }
        : null;

    return { mode, model };
  };

  const emitSettingsChange = (): void => {
    for (const callback of settingsChangeCallbacks) {
      callback(sessionSettings);
    }
  };

  const setSessionSettings = (
    modes?: SessionModeState | null,
    models?: SessionModelState | null,
    configOptions?: readonly SessionConfigOption[] | null
  ): void => {
    sessionSettings = normalizeSettings(modes, models, configOptions);
    emitSettingsChange();
  };

  const updateCurrentMode = (modeId: string): void => {
    if (!sessionSettings.mode) return;
    sessionSettings = {
      ...sessionSettings,
      mode: {
        ...sessionSettings.mode,
        currentValue: modeId,
      },
    };
    emitSettingsChange();
  };

  const updateCurrentModel = (value: string): void => {
    if (!sessionSettings.model) return;
    sessionSettings = {
      ...sessionSettings,
      model: {
        ...sessionSettings.model,
        currentValue: value,
      },
    };
    emitSettingsChange();
  };

  const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  };

  const initialize = (
    rpcClient: JsonRpcClient,
    agentCapabilities: AgentCapabilities,
    cwd: string,
    workspaceAdditionalDirectories: readonly string[]
  ): void => {
    client = rpcClient;
    capabilities = agentCapabilities;
    workingDirectory = cwd;
    additionalDirectories = [...workspaceAdditionalDirectories];
    rpcClient.onNotification((notification: JsonRpcNotification) => {
      if (!replayState?.isLoading) return;
      if (notification.method !== 'session/update') return;

      const params = notification.params as SessionNotification | undefined;
      if (!params?.update) return;
      if (params.sessionId !== replayState.sessionId) return;

      const { sessionUpdate } = params.update;

      if (sessionUpdate === 'current_mode_update') {
        updateCurrentMode((params.update as CurrentModeUpdate).currentModeId);
        return;
      }

      if (sessionUpdate === 'config_option_update' && sessionSettings.model) {
        const configUpdate = params.update as ConfigOptionUpdate;
        const modelConfig = configUpdate.configOptions.find(
          (option): option is SelectConfigOption =>
            isSelectConfigOption(option) && option.id === sessionSettings.model?.id
        );
        if (modelConfig) {
          updateCurrentModel(modelConfig.currentValue);
        }
        return;
      }

      const content = getStreamContent(params.update);
      if (!content) return;

      const role =
        sessionUpdate === 'user_message_chunk'
          ? MessageRole.USER
          : sessionUpdate === 'agent_message_chunk'
            ? MessageRole.ASSISTANT
            : null;

      if (!role) return;

      let message: ChatMessage | null = null;

      if (content.type === 'text') {
        message = {
          id: generateId(),
          role,
          content: content.text,
          timestamp: undefined,
          status: MessageStatus.COMPLETE,
        };
      } else if (content.type === 'resource_link') {
        const fileName = content.name || content.uri.split('/').pop() || 'file';
        const filePath = content.uri.replace(/^file:\/\//, '');
        message = {
          id: generateId(),
          role,
          content: '',
          timestamp: undefined,
          status: MessageStatus.COMPLETE,
          context: [
            {
              filePath,
              fileName,
            },
          ],
        };
      } else if (content.type === 'resource') {
        const uri = content.resource.uri;
        const filePath = uri.replace(/^file:\/\//, '').split('#')[0];
        const fileName = filePath.split('/').pop() || 'file';
        const fileContent = 'text' in content.resource ? (content.resource.text ?? '') : '';
        message = {
          id: generateId(),
          role,
          content: '',
          timestamp: undefined,
          status: MessageStatus.COMPLETE,
          context: [
            {
              filePath,
              fileName,
              content: fileContent,
            },
          ],
        };
      }

      if (message) {
        historyMessageCallbacks.forEach(cb => cb(message));
        replayState.messageCount++;
      }
    });
    logger.info('SessionManager initialized');
  };

  const toSessionEntry = (session: SessionInfo): SessionEntry => ({
    sessionId: session.sessionId,
    title: session.title?.trim() || 'New Session',
    cwd: session.cwd,
    updatedAt: session.updatedAt ?? new Date().toISOString(),
  });

  const setSessions = (nextSessions: readonly SessionEntry[]): void => {
    sessions = [...nextSessions].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  };

  const listSessions = (): TE.TaskEither<GooseError, readonly SessionEntry[]> => {
    if (!client) {
      return TE.left(createJsonRpcError(-32000, 'Client not initialized'));
    }

    if (!capabilities.listSessions) {
      return TE.right(sessions);
    }

    return pipe(
      client.request<ListSessionsResponse>(AGENT_METHODS.session_list, {}),
      TE.map(response => {
        const listedSessions = response.sessions.map(toSessionEntry);
        const activeSessionId = storage.getActiveSessionId();
        const fallbackActive =
          activeSessionId && !listedSessions.some(session => session.sessionId === activeSessionId)
            ? sessions.find(session => session.sessionId === activeSessionId)
            : undefined;

        setSessions(fallbackActive ? [fallbackActive, ...listedSessions] : listedSessions);
        return sessions;
      })
    );
  };

  const createSession = (): TE.TaskEither<GooseError, SessionEntry> => {
    if (!client) {
      return TE.left(createJsonRpcError(-32000, 'Client not initialized'));
    }

    const rpcClient = client;

    return pipe(
      rpcClient.request<NewSessionResponse>(AGENT_METHODS.session_new, {
        cwd: workingDirectory,
        mcpServers: [],
        ...(capabilities.additionalDirectories
          ? { additionalDirectories: additionalDirectories }
          : {}),
      } as Parameters<typeof rpcClient.request<NewSessionResponse>>[1]),
      TE.map(response => {
        const session: SessionEntry = {
          sessionId: response.sessionId,
          title: 'New Session',
          cwd: workingDirectory,
          updatedAt: new Date().toISOString(),
        };

        storage.setActiveSession(session.sessionId);
        setSessions([
          session,
          ...sessions.filter(existing => existing.sessionId !== session.sessionId),
        ]);
        setSessionSettings(response.modes, response.models, response.configOptions);

        logger.info(`Created session: ${session.sessionId}`);
        return session;
      })
    );
  };

  const loadSession = (sessionId: string): TE.TaskEither<GooseError, void> => {
    if (!client) {
      return TE.left(createJsonRpcError(-32000, 'Client not initialized'));
    }

    const session = sessions.find(existing => existing.sessionId === sessionId);
    if (!session) {
      if (!capabilities.listSessions) {
        return TE.left(createJsonRpcError(-32001, `Session not found: ${sessionId}`));
      }
      logger.warn(
        `Session ${sessionId} not found in cached list, attempting load with current working directory`
      );
    }

    if (!capabilities.loadSession) {
      logger.info('loadSession capability not available, switching without history');
      storage.setActiveSession(sessionId);
      return TE.right(undefined);
    }

    const rpcClient = client;
    replayState = {
      sessionId,
      messageCount: 0,
      isLoading: true,
    };

    return pipe(
      rpcClient.request<LoadSessionResponse>(AGENT_METHODS.session_load, {
        sessionId,
        cwd: session?.cwd ?? workingDirectory,
        mcpServers: [],
      }),
      TE.map(response => {
        const completedReplay = replayState;
        replayState = null;
        storage.setActiveSession(sessionId);
        setSessionSettings(response.modes, response.models, response.configOptions);
        historyCompleteCallbacks.forEach(cb => cb(sessionId, completedReplay?.messageCount ?? 0));
        logger.info(
          `Loaded session: ${sessionId} with ${completedReplay?.messageCount ?? 0} messages`
        );
      }),
      TE.mapLeft(error => {
        replayState = null;
        logger.error('Failed to load session:', error);
        return error;
      })
    );
  };

  const getGroupedSessions = (): GroupedSessions[] => {
    return groupSessionsByDate(sessions);
  };

  const getSessions = (): readonly SessionEntry[] => {
    return sessions;
  };

  const getActiveSession = (): SessionEntry | null => {
    const activeId = storage.getActiveSessionId();
    if (!activeId) return null;
    return sessions.find(session => session.sessionId === activeId) ?? null;
  };

  const getActiveSessionId = (): string | null => {
    return storage.getActiveSessionId();
  };

  const getSessionSettings = (): SessionSettingsState => {
    return sessionSettings;
  };

  const setSessionMode = (modeId: string): TE.TaskEither<GooseError, void> => {
    if (!client) {
      return TE.left(createJsonRpcError(-32000, 'Client not initialized'));
    }

    const activeSessionId = storage.getActiveSessionId();
    if (!activeSessionId) {
      return TE.left(createJsonRpcError(-32001, 'No active session'));
    }

    return pipe(
      client.request<unknown>(AGENT_METHODS.session_set_mode, {
        sessionId: activeSessionId,
        modeId,
      }),
      TE.map(() => {
        updateCurrentMode(modeId);
        logger.info(`Updated session mode: ${modeId}`);
      })
    );
  };

  const setSessionModel = (modelId: string): TE.TaskEither<GooseError, void> => {
    if (!client) {
      return TE.left(createJsonRpcError(-32000, 'Client not initialized'));
    }

    const activeSessionId = storage.getActiveSessionId();
    if (!activeSessionId) {
      return TE.left(createJsonRpcError(-32001, 'No active session'));
    }

    if (sessionSettings.model?.id === 'session-model') {
      return pipe(
        client.request<unknown>(AGENT_METHODS.session_set_model, {
          sessionId: activeSessionId,
          modelId,
        }),
        TE.map(() => {
          updateCurrentModel(modelId);
          logger.info(`Updated session model: ${modelId}`);
        })
      );
    }

    if (sessionSettings.model) {
      return pipe(
        client.request<unknown>(AGENT_METHODS.session_set_config_option, {
          sessionId: activeSessionId,
          configId: sessionSettings.model.id,
          value: modelId,
        }),
        TE.map(() => {
          updateCurrentModel(modelId);
          logger.info(`Updated session config model: ${modelId}`);
        })
      );
    }

    return TE.right(undefined);
  };

  const hasLoadSessionCapability = (): boolean => {
    return capabilities.loadSession;
  };

  const hasListSessionsCapability = (): boolean => {
    return capabilities.listSessions;
  };

  const hasAdditionalDirectoriesCapability = (): boolean => {
    return capabilities.additionalDirectories;
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

  const onSettingsChange = (callback: (settings: SessionSettingsState) => void): (() => void) => {
    settingsChangeCallbacks.push(callback);
    return () => {
      const index = settingsChangeCallbacks.indexOf(callback);
      if (index > -1) {
        settingsChangeCallbacks.splice(index, 1);
      }
    };
  };

  const dispose = (): void => {
    client = null;
    historyMessageCallbacks.length = 0;
    historyCompleteCallbacks.length = 0;
    settingsChangeCallbacks.length = 0;
    logger.debug('SessionManager disposed');
  };

  return {
    initialize,
    createSession,
    listSessions,
    loadSession,
    getGroupedSessions,
    getSessions,
    getActiveSession,
    getActiveSessionId,
    getSessionSettings,
    setSessionMode,
    setSessionModel,
    hasLoadSessionCapability,
    hasListSessionsCapability,
    hasAdditionalDirectoriesCapability,
    hasEmbeddedContextCapability,
    onHistoryMessage,
    onHistoryComplete,
    onSettingsChange,
    dispose,
  };
}
