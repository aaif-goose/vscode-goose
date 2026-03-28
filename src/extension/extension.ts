/**
 * Main extension entry point for VS Code Goose Extension.
 * Manages activation, subprocess lifecycle, and webview registration.
 */

import {
  AGENT_METHODS,
  type ContentBlock,
  type InitializeResponse,
  PROTOCOL_VERSION,
  type PromptResponse,
  type SessionNotification,
} from '@agentclientprotocol/sdk';
import * as E from 'fp-ts/Either';
import * as fs from 'fs/promises';
import * as vscode from 'vscode';
import {
  formatError,
  isBinaryNotFoundError,
  isSubprocessSpawnError,
  SubprocessSpawnError,
} from '../shared/errors';
import {
  ContextChipData,
  createChatHistoryMessage,
  createErrorMessage,
  createGenerationCancelledMessage,
  createGenerationCompleteMessage,
  createGenerationErrorMessage,
  createHistoryCompleteMessage,
  createHistoryMessage,
  createSearchResultsMessage,
  createSessionCreatedMessage,
  createSessionLoadedMessage,
  createSessionSettingsMessage,
  createSessionsListMessage,
  createStreamTokenMessage,
  createThinkingDeltaMessage,
  createToolCallStartMessage,
  createToolCallUpdateMessage,
  isCreateSessionMessage,
  isFileSearchMessage,
  isGetSessionsMessage,
  isOpenExternalLinkMessage,
  isSelectSessionMessage,
  isSendMessageMessage,
  isSetSessionModelMessage,
  isSetSessionModeMessage,
  isStopGenerationMessage,
} from '../shared/messages';
import { DEFAULT_CAPABILITIES, SessionEntry } from '../shared/sessionTypes';
import { JsonRpcNotification, ProcessStatus } from '../shared/types';
import { discoverBinary } from './binaryDiscovery';
import { registerCommands, registerContextCommands } from './commands';
import { affectsSetting, getBinaryDiscoveryConfig, getLogLevel, onConfigChange } from './config';
import { createFileSearchService, FileSearchService } from './fileSearchService';
import { JsonRpcClient } from './jsonRpcClient';
import { createLogger, Logger } from './logger';
import { createSessionManager, SessionManager } from './sessionManager';
import { createSessionStorage, SessionStorage } from './sessionStorage';
import { createSubprocessManager, SubprocessManager } from './subprocessManager';
import { checkVersion, MINIMUM_VERSION } from './versionChecker';
import { createWebviewProvider, WebviewProvider } from './webviewProvider';

let logger: Logger | null = null;
let subprocessManager: SubprocessManager | null = null;
let webviewProvider: WebviewProvider | null = null;
let sessionStorage: SessionStorage | null = null;
let sessionManager: SessionManager | null = null;
let fileSearchService: FileSearchService | null = null;

// Mock streaming state
let mockStreamingTimer: ReturnType<typeof setTimeout> | null = null;
let mockStreamingCancelled = false;

const MOCK_RESPONSES = [
  "I'd be happy to help you with that! Let me think about this...\n\nHere's what I suggest:\n\n1. **First step**: Start by understanding the problem\n2. **Second step**: Break it down into smaller parts\n3. **Third step**: Implement the solution\n\n```typescript\nfunction example() {\n  console.log('Hello, world!');\n}\n```\n\nLet me know if you need more details!",
  "Great question! Here's a quick overview:\n\n- This is a **key concept** to understand\n- It works by processing data incrementally\n- The result is then returned to the caller\n\n> Note: This is just a mock response for testing the UI.\n\nWould you like me to elaborate on any part?",
  "Sure thing! Let me explain...\n\nThe main idea here is to keep things simple and focused. Here's an example:\n\n```python\ndef greet(name):\n    return f'Hello, {name}!'\n```\n\nThis demonstrates the basic pattern. The streaming UI should show this text appearing gradually, token by token.",
];

function setupMockStreaming(provider: WebviewProvider, log: Logger): void {
  let currentResponseId: string | null = null;

  provider.onMessage(message => {
    if (isSendMessageMessage(message)) {
      const { content, responseId } = message.payload;
      log.info(`[Mock] Received message: ${content.substring(0, 50)}...`);

      // Use the responseId provided by the webview
      currentResponseId = responseId;
      mockStreamingCancelled = false;

      // Pick a random mock response
      const responseText = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
      const tokens = responseText.split(/(?<=\s)|(?=\s)/); // Split on whitespace boundaries

      let tokenIndex = 0;

      const streamNextToken = (): void => {
        if (mockStreamingCancelled || tokenIndex >= tokens.length) {
          if (!mockStreamingCancelled && currentResponseId) {
            provider.postMessage(createGenerationCompleteMessage(currentResponseId));
            log.info('[Mock] Generation complete');
          }
          mockStreamingTimer = null;
          currentResponseId = null;
          return;
        }

        if (currentResponseId) {
          provider.postMessage(
            createStreamTokenMessage(currentResponseId, tokens[tokenIndex], false)
          );
        }
        tokenIndex++;

        // Random delay between 20-80ms for realistic streaming feel
        const delay = 20 + Math.random() * 60;
        mockStreamingTimer = setTimeout(streamNextToken, delay);
      };

      // Start streaming after a small initial delay
      mockStreamingTimer = setTimeout(streamNextToken, 100);
    }

    if (isStopGenerationMessage(message)) {
      log.info('[Mock] Stop generation requested');
      mockStreamingCancelled = true;

      if (mockStreamingTimer) {
        clearTimeout(mockStreamingTimer);
        mockStreamingTimer = null;
      }

      if (currentResponseId) {
        provider.postMessage(createGenerationCancelledMessage(currentResponseId));
        currentResponseId = null;
      }
    }
  });

  log.info('[Mock] Mock streaming handler registered');
}

/** ACP prompt content block types */
type AcpContentBlock = Extract<ContentBlock, { type: 'text' | 'resource_link' }>;

/** Get MIME type from file path */
function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const mimeTypes: Record<string, string> = {
    ts: 'text/typescript',
    tsx: 'text/typescript',
    js: 'text/javascript',
    jsx: 'text/javascript',
    json: 'application/json',
    md: 'text/markdown',
    py: 'text/x-python',
    rs: 'text/x-rust',
    go: 'text/x-go',
    java: 'text/x-java',
    c: 'text/x-c',
    cpp: 'text/x-c++',
    h: 'text/x-c',
    css: 'text/css',
    html: 'text/html',
    xml: 'text/xml',
    yaml: 'text/yaml',
    yml: 'text/yaml',
    sh: 'text/x-shellscript',
    sql: 'text/x-sql',
  };
  return mimeTypes[ext] ?? 'text/plain';
}

/** Read specific lines from a file */
async function readFileLines(
  filePath: string,
  startLine: number,
  endLine: number
): Promise<string> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  // Lines are 1-indexed in UI, convert to 0-indexed
  const start = Math.max(0, startLine - 1);
  const end = Math.min(lines.length, endLine);
  return lines.slice(start, end).join('\n');
}

/** Build prompt content blocks from message and context chips */
async function buildPromptBlocks(
  content: string,
  chips: readonly ContextChipData[] | undefined,
  log: Logger
): Promise<AcpContentBlock[]> {
  const blocks: AcpContentBlock[] = [];

  if (chips && chips.length > 0) {
    for (const chip of chips) {
      const fileName = chip.filePath.split('/').pop() ?? chip.filePath;

      if (chip.range) {
        // Line range selection: read and send the specific lines as text
        try {
          const selectedContent = await readFileLines(
            chip.filePath,
            chip.range.startLine,
            chip.range.endLine
          );
          const header = `${chip.filePath}:${chip.range.startLine}-${chip.range.endLine}`;
          blocks.push({
            type: 'text',
            text: `File: ${header}\n\`\`\`\n${selectedContent}\n\`\`\``,
          });
          log.debug(`Added selected content from ${header}`);
        } catch (err) {
          log.warn(`Failed to read lines from ${chip.filePath}:`, err);
        }
      } else {
        // Whole file: use resource_link (Goose reads it)
        blocks.push({
          type: 'resource_link',
          uri: `file://${chip.filePath}`,
          name: fileName,
          mimeType: getMimeType(chip.filePath),
        });
        log.debug(`Added resource link: file://${chip.filePath}`);
      }
    }
  }

  // Add user message text
  if (content) {
    blocks.push({ type: 'text', text: content });
  }

  return blocks;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function extractToolPresentation(content: unknown): {
  previewLines?: string[];
} {
  if (!Array.isArray(content)) return {};

  const lines = content.flatMap(item => {
    if (!item || typeof item !== 'object') return [];

    const contentItem = item as Record<string, unknown>;
    if (contentItem.type === 'content') {
      const block = contentItem.content as Record<string, unknown> | undefined;
      if (block?.type === 'text' && typeof block.text === 'string') {
        return block.text
          .split('\n')
          .map(line => line.trimEnd())
          .filter(Boolean);
      }
    }

    if (contentItem.type === 'diff') {
      const path = typeof contentItem.path === 'string' ? contentItem.path : 'unknown';
      return [`diff: ${path}`];
    }

    if (contentItem.type === 'terminal') {
      const terminalId =
        typeof contentItem.terminalId === 'string' ? contentItem.terminalId : 'unknown';
      return [`terminal: ${terminalId}`];
    }

    return [];
  });

  if (lines.length === 0) return {};

  const previewLines = lines.slice(0, 6).map(line => truncateText(line, 160));
  return {
    previewLines,
  };
}

function summarizeSessionUpdate(update: SessionNotification['update']): Record<string, unknown> {
  const base = {
    sessionUpdate: update.sessionUpdate,
  };

  if ('content' in update && !Array.isArray(update.content)) {
    return {
      ...base,
      contentType: update.content.type,
      textPreview: update.content.type === 'text' ? update.content.text.slice(0, 120) : undefined,
    };
  }

  if (update.sessionUpdate === 'tool_call') {
    return {
      ...base,
      toolCallId: update.toolCallId,
      title: update.title,
      status: update.status,
      kind: update.kind,
    };
  }

  if (update.sessionUpdate === 'tool_call_update') {
    return {
      ...base,
      toolCallId: update.toolCallId,
      title: update.title,
      status: update.status,
      kind: update.kind,
      hasRawInput: update.rawInput !== undefined,
      hasRawOutput: update.rawOutput !== undefined,
      contentItems: Array.isArray(update.content) ? update.content.length : 0,
    };
  }

  return base;
}

async function initializeAcpSession(
  client: JsonRpcClient,
  workingDirectory: string,
  manager: SessionManager,
  log: Logger
): Promise<SessionEntry | null> {
  log.info('Initializing ACP connection...');

  // Call ACP initialize to get agent capabilities
  const initResult = await client.request<InitializeResponse>(AGENT_METHODS.initialize, {
    protocolVersion: PROTOCOL_VERSION,
    clientInfo: {
      name: 'vscode-goose',
      version: '0.1.0',
    },
    clientCapabilities: {
      fs: { readTextFile: false, writeTextFile: false },
      terminal: false,
    },
  })();

  let capabilities = DEFAULT_CAPABILITIES;

  if (E.isRight(initResult)) {
    const response = initResult.right;
    log.info(`ACP initialized with protocol version: ${response.protocolVersion}`);

    if (response.agentInfo) {
      log.info(`Agent: ${response.agentInfo.name} v${response.agentInfo.version}`);
    }

    // Parse capabilities from response
    const agentCaps = response.agentCapabilities;
    if (agentCaps) {
      capabilities = {
        loadSession: agentCaps.loadSession ?? DEFAULT_CAPABILITIES.loadSession,
        promptCapabilities: {
          image: agentCaps.promptCapabilities?.image ?? false,
          audio: agentCaps.promptCapabilities?.audio ?? false,
          embeddedContext: agentCaps.promptCapabilities?.embeddedContext ?? false,
        },
      };
      log.info(
        `Agent capabilities: loadSession=${capabilities.loadSession}, embeddedContext=${capabilities.promptCapabilities.embeddedContext}`
      );
    }
  } else {
    log.warn('ACP initialize failed, using default capabilities:', initResult.left);
  }

  manager.initialize(client, capabilities, workingDirectory);

  const existingSession = manager.getActiveSession();
  if (existingSession) {
    log.info(`Found existing session: ${existingSession.sessionId}, attempting to restore...`);

    // Try to restore the session with the server
    if (manager.hasLoadSessionCapability()) {
      const loadResult = await manager.loadSession(existingSession.sessionId)();
      if (E.isRight(loadResult)) {
        log.info(`Successfully restored session: ${existingSession.sessionId}`);
        return existingSession;
      }
      log.warn(`Failed to restore session ${existingSession.sessionId}, creating new session`);
    } else {
      // Server doesn't support session/load - create a fresh session
      log.info('Server does not support session/load, creating new session');
    }
  }

  const result = await manager.createSession()();

  if (E.isLeft(result)) {
    log.error('Failed to create ACP session:', result.left);
    return null;
  }

  log.info(`ACP session created: ${result.right.sessionId}`);
  return result.right;
}

function setupAcpCommunication(
  provider: WebviewProvider,
  client: JsonRpcClient,
  manager: SessionManager,
  log: Logger
): void {
  let currentResponseId: string | null = null;

  const getActiveSessionId = (): string | null => {
    return manager.getActiveSessionId();
  };

  client.onNotification((notification: JsonRpcNotification) => {
    const method = notification.method;
    const params = notification.params as SessionNotification | undefined;

    if (method === 'session/update' && params?.update) {
      log.debug('ACP session/update received', {
        sessionId: params.sessionId,
        responseId: currentResponseId,
        update: summarizeSessionUpdate(params.update),
      });

      const { sessionUpdate } = params.update;

      if (!currentResponseId) return;

      if (
        sessionUpdate === 'agent_message_chunk' &&
        'content' in params.update &&
        !Array.isArray(params.update.content) &&
        params.update.content.type === 'text'
      ) {
        provider.postMessage(
          createStreamTokenMessage(currentResponseId, params.update.content.text, false)
        );
        return;
      }

      if (
        sessionUpdate === 'agent_thought_chunk' &&
        'content' in params.update &&
        !Array.isArray(params.update.content) &&
        params.update.content.type === 'text'
      ) {
        provider.postMessage(
          createThinkingDeltaMessage(currentResponseId, params.update.content.text)
        );
        return;
      }

      if (sessionUpdate === 'tool_call') {
        provider.postMessage(
          createToolCallStartMessage(
            currentResponseId,
            params.update.toolCallId,
            params.update.title,
            params.update.status,
            {
              kind: params.update.kind,
              rawInput: params.update.rawInput,
              locations: params.update.locations,
            }
          )
        );
        return;
      }

      if (sessionUpdate === 'tool_call_update') {
        const presentation = extractToolPresentation(params.update.content);
        provider.postMessage(
          createToolCallUpdateMessage(currentResponseId, params.update.toolCallId, {
            title: params.update.title ?? undefined,
            status: params.update.status ?? undefined,
            kind: params.update.kind ?? undefined,
            rawInput: params.update.rawInput,
            rawOutput: params.update.rawOutput,
            contentPreview: presentation.previewLines,
            locations: params.update.locations ?? undefined,
          })
        );
      }
    }
  });

  manager.onHistoryMessage(message => {
    provider.postMessage(createHistoryMessage(message));
  });

  manager.onHistoryComplete((sessionId, messageCount) => {
    provider.postMessage(createHistoryCompleteMessage(sessionId, messageCount));
  });

  manager.onSettingsChange(settings => {
    provider.postMessage(createSessionSettingsMessage(settings));
  });

  provider.onMessage(message => {
    if (isSendMessageMessage(message)) {
      const { content, responseId, contextChips } = message.payload;
      currentResponseId = responseId;
      const activeSessionId = getActiveSessionId();

      if (!activeSessionId) {
        log.error('No active session');
        provider.postMessage(
          createErrorMessage('No Active Session', 'Please create or select a session first.')
        );
        return;
      }

      log.info(`Sending message to ACP: ${content.substring(0, 50)}...`);
      if (contextChips && contextChips.length > 0) {
        log.info(`With ${contextChips.length} context chip(s)`);
      }

      const activeSession = manager.getActiveSession();
      if (activeSession && activeSession.title === 'New Session') {
        manager.updateSessionTitle(activeSession.sessionId, content);
      }

      const sendRequest = async (): Promise<void> => {
        // Build prompt content blocks with resource links for context
        const promptBlocks = await buildPromptBlocks(content, contextChips, log);

        const result = await client.request<PromptResponse>(
          AGENT_METHODS.session_prompt,
          {
            sessionId: activeSessionId,
            prompt: promptBlocks,
          },
          {
            timeoutMs: null,
          }
        )();

        if (E.isLeft(result)) {
          log.error('ACP request failed:', result.left);
          provider.postMessage(
            createErrorMessage(
              'Message Send Failed',
              `Failed to send message: ${result.left.message}`,
              { label: 'View Logs', command: 'goose.showLogs' }
            )
          );
          if (currentResponseId) {
            provider.postMessage(
              createGenerationErrorMessage(currentResponseId, result.left.message)
            );
            currentResponseId = null;
          }
        } else {
          log.info(`Generation completed with stopReason: ${result.right.stopReason}`, {
            responseId: currentResponseId,
            sessionId: activeSessionId,
          });
          if (currentResponseId) {
            if (result.right.stopReason === 'cancelled') {
              provider.postMessage(createGenerationCancelledMessage(currentResponseId));
            } else {
              provider.postMessage(createGenerationCompleteMessage(currentResponseId));
            }
            currentResponseId = null;
          }
        }
      };

      sendRequest();
    }

    if (isStopGenerationMessage(message)) {
      const activeSessionId = getActiveSessionId();
      if (activeSessionId) {
        log.info('Sending cancel request to ACP');
        const cancelResult = client.notify('session/cancel', { sessionId: activeSessionId });
        if (E.isLeft(cancelResult)) {
          log.error('Failed to send cancel notification:', cancelResult.left);
        }
      }
    }

    if (isCreateSessionMessage(message)) {
      log.info('Creating new session...');
      manager
        .createSession()()
        .then(result => {
          if (E.isRight(result)) {
            provider.postMessage(createSessionCreatedMessage(result.right));
            provider.postMessage(
              createSessionsListMessage(manager.getSessions(), result.right.sessionId)
            );
            provider.postMessage(createSessionSettingsMessage(manager.getSessionSettings()));
            log.info(`New session created: ${result.right.sessionId}`);
          } else {
            log.error('Failed to create session:', result.left);
            provider.postMessage(
              createErrorMessage('Session Creation Failed', result.left.message)
            );
          }
        });
    }

    if (isGetSessionsMessage(message)) {
      log.debug('Sending session list');
      provider.postMessage(
        createSessionsListMessage(manager.getSessions(), manager.getActiveSessionId())
      );
      provider.postMessage(createSessionSettingsMessage(manager.getSessionSettings()));
    }

    if (isSelectSessionMessage(message)) {
      const { sessionId } = message.payload;
      log.info(`Switching to session: ${sessionId}`);

      // Clear chat before loading history
      provider.postMessage(createChatHistoryMessage([]));

      manager
        .loadSession(sessionId)()
        .then(result => {
          if (E.isRight(result)) {
            provider.postMessage(
              createSessionLoadedMessage(sessionId, !manager.hasLoadSessionCapability())
            );
            provider.postMessage(createSessionsListMessage(manager.getSessions(), sessionId));
            provider.postMessage(createSessionSettingsMessage(manager.getSessionSettings()));
            log.info(`Session loaded: ${sessionId}`);
          } else {
            log.error('Failed to load session:', result.left);
            provider.postMessage(createErrorMessage('Session Load Failed', result.left.message));
          }
        });
    }

    if (isSetSessionModeMessage(message)) {
      const { modeId } = message.payload;
      manager
        .setSessionMode(modeId)()
        .then(result => {
          if (E.isLeft(result)) {
            log.error('Failed to set session mode:', result.left);
            provider.postMessage(createErrorMessage('Mode Update Failed', result.left.message));
          }
        });
    }

    if (isSetSessionModelMessage(message)) {
      const { modelId } = message.payload;
      manager
        .setSessionModel(modelId)()
        .then(result => {
          if (E.isLeft(result)) {
            log.error('Failed to set session model:', result.left);
            provider.postMessage(createErrorMessage('Model Update Failed', result.left.message));
          }
        });
    }
  });

  log.info('ACP communication handler registered');
}

function getWorkspaceFolder(): string {
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return folders[0].uri.fsPath;
  }
  return process.cwd();
}

function setupExternalLinkHandler(provider: WebviewProvider, log: Logger): void {
  provider.onMessage(message => {
    if (isOpenExternalLinkMessage(message)) {
      const { url } = message.payload;
      log.info(`Opening external link: ${url}`);
      vscode.env.openExternal(vscode.Uri.parse(url));
    }
  });
  log.debug('External link handler registered');
}

function setupFileSearchHandler(
  provider: WebviewProvider,
  searchService: FileSearchService,
  log: Logger
): void {
  provider.onMessage(async message => {
    if (isFileSearchMessage(message)) {
      const { query } = message.payload;
      log.debug(`File search request: "${query}"`);

      try {
        const results = await searchService.search(query);
        provider.postMessage(createSearchResultsMessage(results));
        log.debug(`File search returned ${results.length} results`);
      } catch (error) {
        log.error('File search failed:', error);
        provider.postMessage(createSearchResultsMessage([]));
      }
    }
  });
  log.debug('File search handler registered');
}

function showSubprocessError(error: SubprocessSpawnError): void {
  vscode.window
    .showErrorMessage(
      `Failed to start Goose: ${error.code}. Check the Goose output for details.`,
      'View Logs'
    )
    .then(selection => {
      if (selection === 'View Logs') {
        vscode.commands.executeCommand('goose.showLogs');
      }
    });
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const outputChannel = vscode.window.createOutputChannel('Goose');
  logger = createLogger(outputChannel, getLogLevel());

  logger.info('Goose extension activating...');

  sessionStorage = createSessionStorage(context.globalState);
  sessionManager = createSessionManager(sessionStorage, logger.child('Session'));

  webviewProvider = createWebviewProvider({
    extensionUri: context.extensionUri,
    logger: logger.child('Webview'),
  });

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('goose.chatView', webviewProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  registerCommands(context, {
    logger,
    outputChannel,
    subprocessManager,
    getSubprocessManager: () => subprocessManager,
  });

  registerContextCommands(context, {
    logger: logger.child('Context'),
    webviewProvider,
    getSessionManager: () => sessionManager,
  });

  setupExternalLinkHandler(webviewProvider, logger.child('Links'));

  fileSearchService = createFileSearchService(logger.child('FileSearch'));
  setupFileSearchHandler(webviewProvider, fileSearchService, logger.child('FileSearch'));

  const binaryResult = discoverBinary(getBinaryDiscoveryConfig());

  if (E.isLeft(binaryResult)) {
    const error = binaryResult.left;
    logger.error('Binary discovery failed:', formatError(error));

    if (isBinaryNotFoundError(error)) {
      // Send version status to webview for in-panel messaging
      webviewProvider.updateVersionStatus({
        status: 'blocked_missing',
        minimumVersion: MINIMUM_VERSION,
        installUrl: 'https://block.github.io/goose/docs/quickstart',
      });
    }

    logger.info('Goose extension activated (binary not found - version check blocked).');
    return;
  }

  const binaryPath = binaryResult.right;
  logger.info(`Found goose binary at: ${binaryPath}`);

  // Version check before spawning subprocess
  const versionResult = await checkVersion(binaryPath)();

  if (E.isLeft(versionResult)) {
    const error = versionResult.left;
    logger.error(
      `Goose version check failed: detected ${error.detectedVersion}, requires ${error.minimumVersion}`
    );

    webviewProvider.updateVersionStatus({
      status: 'blocked_outdated',
      detectedVersion: error.detectedVersion,
      minimumVersion: error.minimumVersion,
      updateUrl: error.updateUrl,
    });

    logger.info('Goose extension activated (version incompatible - version check blocked).');
    return;
  }

  logger.info(
    `Goose version ${versionResult.right.version} detected (meets minimum ${MINIMUM_VERSION})`
  );

  subprocessManager = createSubprocessManager({
    logger: logger.child('Subprocess'),
    workingDirectory: getWorkspaceFolder(),
  });

  subprocessManager.onStatusChange(status => {
    logger?.info(`Subprocess status: ${status}`);
    webviewProvider?.updateStatus(status);

    if (status === ProcessStatus.ERROR) {
      vscode.window.showWarningMessage(
        'Goose subprocess crashed. Use "Goose: Restart" to reconnect.'
      );
    }
  });

  const startResult = await subprocessManager.start(binaryPath)();

  if (E.isLeft(startResult)) {
    const error = startResult.left;
    logger.error('Failed to start subprocess:', formatError(error));

    if (isSubprocessSpawnError(error)) {
      showSubprocessError(error);
    }

    setupMockStreaming(webviewProvider, logger.child('Mock'));
    logger.info('[Mock] Mock streaming enabled (subprocess failed to start)');
  } else {
    logger.info('Subprocess started successfully');
    webviewProvider.updateStatus(ProcessStatus.RUNNING);

    const clientResult = subprocessManager.getClient();
    if (E.isRight(clientResult)) {
      const client = clientResult.right;
      const session = await initializeAcpSession(
        client,
        getWorkspaceFolder(),
        sessionManager,
        logger.child('ACP')
      );

      if (session) {
        setupAcpCommunication(webviewProvider, client, sessionManager, logger.child('ACP'));
        logger.info('ACP communication enabled');
      } else {
        setupMockStreaming(webviewProvider, logger.child('Mock'));
        logger.info('[Mock] Mock streaming enabled (session initialization failed)');
      }
    } else {
      setupMockStreaming(webviewProvider, logger.child('Mock'));
      logger.info('[Mock] Mock streaming enabled (no client available)');
    }
  }

  registerConfigChangeHandler(context);

  logger.info('Goose extension activated.');
}

function registerConfigChangeHandler(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    onConfigChange(e => {
      if (affectsSetting(e, 'logLevel')) {
        logger?.setLevel(getLogLevel());
        logger?.info('Log level updated');
      }
      if (affectsSetting(e, 'binaryPath')) {
        logger?.info('Binary path setting changed - use "Goose: Restart" to apply');
      }
    })
  );
}

export async function deactivate(): Promise<void> {
  logger?.info('Goose extension deactivating...');

  if (sessionManager) {
    sessionManager.dispose();
    sessionManager = null;
  }

  if (fileSearchService) {
    fileSearchService.dispose();
    fileSearchService = null;
  }

  if (subprocessManager) {
    await subprocessManager.stop()();
    subprocessManager = null;
  }

  sessionStorage = null;

  logger?.info('Goose extension deactivated.');
}
