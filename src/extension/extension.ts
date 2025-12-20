/**
 * Main extension entry point for VS Code Goose Extension.
 * Manages activation, subprocess lifecycle, and webview registration.
 */

import * as vscode from 'vscode';
import * as E from 'fp-ts/Either';
import { createLogger, Logger } from './logger';
import { getLogLevel, getBinaryDiscoveryConfig, onConfigChange, affectsSetting } from './config';
import { discoverBinary } from './binaryDiscovery';
import {
  formatError,
  isBinaryNotFoundError,
  isSubprocessSpawnError,
  SubprocessSpawnError,
} from '../shared/errors';
import { createSubprocessManager, SubprocessManager } from './subprocessManager';
import { createWebviewProvider, WebviewProvider } from './webviewProvider';
import { registerCommands, registerContextCommands } from './commands';
import { checkVersion, MINIMUM_VERSION } from './versionChecker';
import { ProcessStatus, JsonRpcNotification } from '../shared/types';
import {
  isSendMessageMessage,
  isStopGenerationMessage,
  isCreateSessionMessage,
  isGetSessionsMessage,
  isSelectSessionMessage,
  isOpenExternalLinkMessage,
  isFileSearchMessage,
  createStreamTokenMessage,
  createGenerationCompleteMessage,
  createGenerationCancelledMessage,
  createErrorMessage,
  createSessionCreatedMessage,
  createSessionsListMessage,
  createSessionLoadedMessage,
  createHistoryMessage,
  createHistoryCompleteMessage,
  createChatHistoryMessage,
  createSearchResultsMessage,
} from '../shared/messages';
import { JsonRpcClient } from './jsonRpcClient';
import { createSessionStorage, SessionStorage } from './sessionStorage';
import { createSessionManager, SessionManager } from './sessionManager';
import { createFileSearchService, FileSearchService } from './fileSearchService';
import { DEFAULT_CAPABILITIES, SessionEntry } from '../shared/sessionTypes';

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

interface AcpSessionUpdateParams {
  readonly sessionId: string;
  readonly update: {
    readonly sessionUpdate: string;
    readonly content?: {
      readonly type: string;
      readonly text?: string;
    };
  };
}

interface AcpPromptResponse {
  readonly stopReason: 'end_turn' | 'max_tokens' | 'max_turn_requests' | 'refusal' | 'cancelled';
}

async function initializeAcpSession(
  client: JsonRpcClient,
  workingDirectory: string,
  manager: SessionManager,
  log: Logger
): Promise<SessionEntry | null> {
  log.info('Initializing ACP session...');

  manager.initialize(client, DEFAULT_CAPABILITIES, workingDirectory);

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
    const params = notification.params as AcpSessionUpdateParams | undefined;

    if (method === 'session/update' && params?.update) {
      const { sessionUpdate, content } = params.update;

      if (sessionUpdate === 'agent_message_chunk' && content?.text && currentResponseId) {
        provider.postMessage(createStreamTokenMessage(currentResponseId, content.text, false));
      }
    }
  });

  manager.onHistoryMessage(message => {
    provider.postMessage(createHistoryMessage(message));
  });

  manager.onHistoryComplete((sessionId, messageCount) => {
    provider.postMessage(createHistoryCompleteMessage(sessionId, messageCount));
  });

  provider.onMessage(message => {
    if (isSendMessageMessage(message)) {
      const { content, responseId } = message.payload;
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

      const activeSession = manager.getActiveSession();
      if (activeSession && activeSession.title === 'New Session') {
        manager.updateSessionTitle(activeSession.sessionId, content);
      }

      const sendRequest = async (): Promise<void> => {
        const result = await client.request<AcpPromptResponse>('session/prompt', {
          sessionId: activeSessionId,
          prompt: [
            {
              type: 'text',
              text: content,
            },
          ],
        })();

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
            provider.postMessage(createGenerationCancelledMessage(currentResponseId));
            currentResponseId = null;
          }
        } else {
          log.info(`Generation completed with stopReason: ${result.right.stopReason}`);
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
            log.info(`Session loaded: ${sessionId}`);
          } else {
            log.error('Failed to load session:', result.left);
            provider.postMessage(createErrorMessage('Session Load Failed', result.left.message));
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
