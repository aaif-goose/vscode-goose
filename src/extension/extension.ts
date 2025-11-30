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
  BinaryNotFoundError,
  SubprocessSpawnError,
} from '../shared/errors';
import { createSubprocessManager, SubprocessManager } from './subprocessManager';
import { createWebviewProvider, WebviewProvider } from './webviewProvider';
import { registerCommands } from './commands';
import { ProcessStatus, JsonRpcNotification } from '../shared/types';
import {
  isSendMessageMessage,
  isStopGenerationMessage,
  createStreamTokenMessage,
  createGenerationCompleteMessage,
  createGenerationCancelledMessage,
  createErrorMessage,
} from '../shared/messages';
import { JsonRpcClient } from './jsonRpcClient';

let logger: Logger | null = null;
let subprocessManager: SubprocessManager | null = null;
let webviewProvider: WebviewProvider | null = null;

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

interface AcpSessionNewResponse {
  readonly sessionId: string;
}

async function initializeAcpSession(
  client: JsonRpcClient,
  workingDirectory: string,
  log: Logger
): Promise<string | null> {
  log.info('Initializing ACP session...');

  const result = await client.request<AcpSessionNewResponse>('session/new', {
    cwd: workingDirectory,
    mcpServers: [],
  })();

  if (E.isLeft(result)) {
    log.error('Failed to create ACP session:', result.left);
    return null;
  }

  log.info(`ACP session created: ${result.right.sessionId}`);
  return result.right.sessionId;
}

function setupAcpCommunication(
  provider: WebviewProvider,
  client: JsonRpcClient,
  sessionId: string,
  log: Logger
): void {
  let currentResponseId: string | null = null;

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

  provider.onMessage(message => {
    if (isSendMessageMessage(message)) {
      const { content, responseId } = message.payload;
      currentResponseId = responseId;
      log.info(`Sending message to ACP: ${content.substring(0, 50)}...`);

      const sendRequest = async (): Promise<void> => {
        const result = await client.request<AcpPromptResponse>('session/prompt', {
          sessionId,
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
      log.info('Sending cancel request to ACP');
      const cancelResult = client.notify('session/cancel', { sessionId });
      if (E.isLeft(cancelResult)) {
        log.error('Failed to send cancel notification:', cancelResult.left);
      }
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

function showBinaryNotFoundError(error: BinaryNotFoundError): void {
  vscode.window
    .showErrorMessage(
      'Goose binary not found. Please install Goose or configure goose.binaryPath.',
      'Install Goose',
      'Open Settings'
    )
    .then(selection => {
      if (selection === 'Install Goose') {
        vscode.env.openExternal(vscode.Uri.parse(error.installationUrl));
      } else if (selection === 'Open Settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'goose.binaryPath');
      }
    });
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

  webviewProvider = createWebviewProvider({
    extensionUri: context.extensionUri,
    logger: logger.child('Webview'),
  });

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('goose.chatView', webviewProvider)
  );

  registerCommands(context, {
    logger,
    outputChannel,
    subprocessManager,
    getSubprocessManager: () => subprocessManager,
  });

  const binaryResult = discoverBinary(getBinaryDiscoveryConfig());

  if (E.isLeft(binaryResult)) {
    const error = binaryResult.left;
    logger.error('Binary discovery failed:', formatError(error));

    if (isBinaryNotFoundError(error)) {
      showBinaryNotFoundError(error);
    }

    logger.info('Goose extension activated (binary not found - limited functionality).');
    return;
  }

  const binaryPath = binaryResult.right;
  logger.info(`Found goose binary at: ${binaryPath}`);

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
      const sessionId = await initializeAcpSession(
        client,
        getWorkspaceFolder(),
        logger.child('ACP')
      );

      if (sessionId) {
        setupAcpCommunication(webviewProvider, client, sessionId, logger.child('ACP'));
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

  if (subprocessManager) {
    await subprocessManager.stop()();
    subprocessManager = null;
  }

  logger?.info('Goose extension deactivated.');
}
