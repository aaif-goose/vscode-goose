/**
 * Main extension entry point for VS Code Goose Extension.
 * Manages activation, subprocess lifecycle, and webview registration.
 */

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
  createHistoryCompleteMessage,
  createHistoryMessage,
  createSearchResultsMessage,
  createSessionCreatedMessage,
  createSessionLoadedMessage,
  createSessionsListMessage,
  createStreamTokenMessage,
  isCreateSessionMessage,
  isFileSearchMessage,
  isGetSessionsMessage,
  isOpenExternalLinkMessage,
  isSelectSessionMessage,
  isSendMessageMessage,
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

/** ACP streaming content block types */
type AcpStreamContentBlock =
  | { readonly type: 'text'; readonly text: string }
  | {
      readonly type: 'resource_link';
      readonly uri: string;
      readonly name: string;
      readonly mimeType?: string;
    }
  | {
      readonly type: 'resource';
      readonly resource: {
        readonly uri: string;
        readonly text?: string;
        readonly blob?: string;
        readonly mimeType?: string;
      };
    };

interface AcpSessionUpdateParams {
  readonly sessionId: string;
  readonly update: {
    readonly sessionUpdate: string;
    readonly content?: AcpStreamContentBlock;
  };
}

interface AcpPromptResponse {
  readonly stopReason: 'end_turn' | 'max_tokens' | 'max_turn_requests' | 'refusal' | 'cancelled';
}

interface AcpInitializeResponse {
  readonly protocolVersion: number;
  readonly agentCapabilities?: {
    readonly loadSession?: boolean;
    readonly promptCapabilities?: {
      readonly audio?: boolean;
      readonly image?: boolean;
      readonly embeddedContext?: boolean;
    };
  };
  readonly agentInfo?: {
    readonly name?: string;
    readonly version?: string;
  };
}

/** ACP prompt content block types */
type AcpContentBlock =
  | { type: 'text'; text: string }
  | { type: 'resource_link'; uri: string; name: string; mimeType?: string };

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

async function initializeAcpSession(
  client: JsonRpcClient,
  workingDirectory: string,
  manager: SessionManager,
  log: Logger
): Promise<SessionEntry | null> {
  log.info('Initializing ACP connection...');

  // Call ACP initialize to get agent capabilities
  const initResult = await client.request<AcpInitializeResponse>('initialize', {
    protocolVersion: 1,
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

/**
 * Register forwarders for `SessionManager`'s history callbacks. MUST run
 * BEFORE the first `initializeAcpSession` so the `session/load` replay
 * triggered during startup actually reaches the webview. When the restart
 * flow silently reattaches an existing session the webview already holds the
 * live transcript; `suppressHistoryReplay.current = true` skips forwarding in
 * that window so we don't overwrite live timestamps with "Earlier" labels.
 */
function registerHistoryForwarding(
  provider: WebviewProvider,
  manager: SessionManager,
  suppressHistoryReplay: { current: boolean }
): void {
  manager.onHistoryMessage(message => {
    if (suppressHistoryReplay.current) return;
    provider.postMessage(createHistoryMessage(message));
  });

  manager.onHistoryComplete((sessionId, messageCount) => {
    if (suppressHistoryReplay.current) return;
    provider.postMessage(createHistoryCompleteMessage(sessionId, messageCount));
  });
}

/**
 * Register the webview-side message handlers (send, cancel, session CRUD)
 * against the ACP subprocess. Runs AFTER `initializeAcpSession` succeeds;
 * deliberately split from history-forwarding registration so the mock
 * fallback path can run without also receiving ACP send events.
 */
function setupAcpWebviewHandlers(
  provider: WebviewProvider,
  subprocess: SubprocessManager,
  manager: SessionManager,
  log: Logger,
  responseIdRef: { current: string | null }
): void {
  const getActiveSessionId = (): string | null => {
    return manager.getActiveSessionId();
  };

  // Resolve the current client lazily on every use so that a restart
  // (which creates a fresh JsonRpcClient inside SubprocessManager) is
  // picked up automatically instead of binding to a stale closure.
  const withClient = <T>(op: (client: JsonRpcClient) => T, onMissing: (err: unknown) => T): T => {
    const clientResult = subprocess.getClient();
    if (E.isLeft(clientResult)) {
      return onMissing(clientResult.left);
    }
    return op(clientResult.right);
  };

  provider.onMessage(message => {
    if (isSendMessageMessage(message)) {
      const { content, responseId, contextChips } = message.payload;
      responseIdRef.current = responseId;
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

        const clientResult = subprocess.getClient();
        if (E.isLeft(clientResult)) {
          log.error('No ACP client available:', clientResult.left);
          // The webview's ADD_ERROR_MESSAGE reducer cleans up the optimistic
          // assistant placeholder, so we don't need to also post
          // GENERATION_COMPLETE here (which would leave a blank bubble).
          provider.postMessage(
            createErrorMessage(
              'Message Send Failed',
              'Goose subprocess is not running. Try "Goose: Restart".',
              { label: 'View Logs', command: 'goose.showLogs' }
            )
          );
          responseIdRef.current = null;
          return;
        }

        // `session/prompt` streams the agent's full reply and can legitimately
        // take far longer than the client's default request timeout. Pass
        // `timeoutMs: null` so the client-side timer never fires; cancellation
        // still flows through `session/cancel`.
        const result = await clientResult.right.request<AcpPromptResponse>(
          'session/prompt',
          {
            sessionId: activeSessionId,
            prompt: promptBlocks,
          },
          { timeoutMs: null }
        )();

        if (E.isLeft(result)) {
          log.error('ACP request failed:', result.left);
          // The webview's ADD_ERROR_MESSAGE reducer drops the empty assistant
          // placeholder (or marks a partially-streamed one complete) and
          // resets isGenerating. No GENERATION_COMPLETE needed -- sending
          // both would leave a blank bubble above the error row.
          provider.postMessage(
            createErrorMessage(
              'Message Send Failed',
              `Failed to send message: ${result.left.message}`,
              { label: 'View Logs', command: 'goose.showLogs' }
            )
          );
          responseIdRef.current = null;
        } else {
          log.info(`Generation completed with stopReason: ${result.right.stopReason}`);
          if (responseIdRef.current) {
            if (result.right.stopReason === 'cancelled') {
              provider.postMessage(createGenerationCancelledMessage(responseIdRef.current));
            } else {
              provider.postMessage(createGenerationCompleteMessage(responseIdRef.current));
            }
            responseIdRef.current = null;
          }
        }
      };

      sendRequest();
    }

    if (isStopGenerationMessage(message)) {
      const activeSessionId = getActiveSessionId();
      if (activeSessionId) {
        log.info('Sending cancel request to ACP');
        withClient(
          client => {
            const cancelResult = client.notify('session/cancel', { sessionId: activeSessionId });
            if (E.isLeft(cancelResult)) {
              log.error('Failed to send cancel notification:', cancelResult.left);
            }
          },
          err => {
            log.warn('Cannot cancel: no ACP client available', err);
          }
        );
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

/**
 * Re-run the ACP handshake against the current subprocess client and reconcile
 * session state. Called on every `ProcessStatus.RUNNING` transition AFTER the
 * initial activation (e.g. on `Goose: Restart`). The fresh `goose acp` process
 * does not know any of the previously-issued session ids, so `initializeAcpSession`
 * will typically fall through to `session/new`; if that happens we notify the
 * webview so the new session id is picked up for subsequent prompts.
 */
async function reinitializeAcpOnRestart(
  provider: WebviewProvider,
  subprocess: SubprocessManager,
  manager: SessionManager,
  workingDirectory: string,
  log: Logger,
  suppressHistoryReplay: { current: boolean }
): Promise<void> {
  const clientResult = subprocess.getClient();
  if (E.isLeft(clientResult)) {
    log.debug('Skipping ACP re-init: no client available');
    return;
  }

  // Suppress history forwarding for the duration of the handshake. If the
  // fresh subprocess can `session/load` the prior session, we want the
  // webview to keep its live transcript as-is (otherwise every message would
  // re-render as "Earlier"). Only clear + repopulate if we fall through to
  // `session/new`, because then the webview's live messages belong to a
  // session id the new subprocess no longer knows about.
  const previousSessionId = manager.getActiveSessionId();
  suppressHistoryReplay.current = true;
  let session: SessionEntry | null = null;
  try {
    session = await initializeAcpSession(clientResult.right, workingDirectory, manager, log);
  } finally {
    suppressHistoryReplay.current = false;
  }

  if (!session) {
    log.warn('ACP re-init after restart failed to establish a session');
    return;
  }

  const isFreshSession = session.sessionId !== previousSessionId;
  if (isFreshSession) {
    log.info(`ACP re-init created fresh session ${session.sessionId} after restart`);
    // The webview's live messages belonged to the dead session id; replace
    // them with an empty transcript so the UI matches the new server state.
    provider.postMessage(createChatHistoryMessage([]));
    provider.postMessage(createSessionCreatedMessage(session));
  } else {
    log.info(`ACP re-init silently reattached session ${session.sessionId} after restart`);
  }
  provider.postMessage(createSessionsListMessage(manager.getSessions(), session.sessionId));
}

/**
 * Attach the `session/update` notification handler to the current JsonRpcClient.
 *
 * Called once on first successful activation and again on every subsequent
 * `ProcessStatus.RUNNING` transition (e.g. after `Goose: Restart`). A guard
 * ref tracks the last client we subscribed to so we never double-subscribe.
 */
function subscribeSessionUpdates(
  provider: WebviewProvider,
  subprocess: SubprocessManager,
  responseIdRef: { current: string | null },
  log: Logger,
  lastSubscribedClient: { current: JsonRpcClient | null },
  suppressHistoryReplay: { current: boolean }
): void {
  const clientResult = subprocess.getClient();
  if (E.isLeft(clientResult)) {
    log.debug('Skipping session/update subscription: no client available');
    return;
  }
  const client = clientResult.right;
  if (lastSubscribedClient.current === client) {
    return;
  }
  lastSubscribedClient.current = client;

  client.onNotification((notification: JsonRpcNotification) => {
    const method = notification.method;
    const params = notification.params as AcpSessionUpdateParams | undefined;

    if (method === 'session/update' && params?.update) {
      const { sessionUpdate, content } = params.update;
      const responseId = responseIdRef.current;

      if (sessionUpdate === 'agent_message_chunk' && responseId && content?.type === 'text') {
        // Guard against the restart race: while a session/load replay is in
        // flight (`suppressHistoryReplay === true`), historical chunks must
        // not be appended to an in-flight live assistant response. The load
        // branch of SessionManager handles those chunks as history itself.
        if (suppressHistoryReplay.current) return;
        provider.postMessage(createStreamTokenMessage(responseId, content.text, false));
      }
    }
  });

  log.info('Subscribed to session/update notifications');
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

  // Shared refs so the `session/update` subscriber and the webview message
  // handler observe the same streaming response id, and so we never
  // double-subscribe to the same JsonRpcClient instance across restarts.
  const responseIdRef: { current: string | null } = { current: null };
  const lastSubscribedClient: { current: JsonRpcClient | null } = { current: null };
  // When true, history messages emitted by `SessionManager.loadSession` are
  // NOT forwarded to the webview. Used by the restart flow to silently
  // reattach an existing session without re-rendering the live transcript.
  const suppressHistoryReplay: { current: boolean } = { current: false };
  // Tracks whether the initial ACP handshake has completed. Post-restart
  // RUNNING transitions use this to decide whether to re-run the handshake
  // against the fresh subprocess (skip on the very first RUNNING because the
  // activation path below runs `initializeAcpSession` inline).
  let acpInitialized = false;

  const acpLogger = logger.child('ACP');

  subprocessManager.onStatusChange(status => {
    logger?.info(`Subprocess status: ${status}`);

    // Never broadcast RUNNING from here: the webview must not enable send
    // until the ACP handshake (initial or restart) has completed, otherwise
    // the first prompt races and fails with Session not found. Both the
    // initial activation path and the restart path below emit RUNNING
    // inline once the handshake finishes. Other statuses (STARTING, STOPPED,
    // ERROR) are forwarded immediately so the webview can reflect them.
    if (status !== ProcessStatus.RUNNING) {
      webviewProvider?.updateStatus(status);
    }

    // Note: we deliberately do NOT close out the streaming assistant bubble
    // or null `responseIdRef` here. When the subprocess dies mid-generation,
    // `JsonRpcClient.dispose()` rejects every pending request; the
    // `sendRequest` error path then runs, posts an `ErrorMessage`, and
    // `ADD_ERROR_MESSAGE` in the webview reducer removes the optimistic
    // placeholder. Handling the cleanup from two places would race to post
    // both a COMPLETE and an ERROR for the same bubble.

    if (status === ProcessStatus.ERROR) {
      vscode.window.showWarningMessage(
        'Goose subprocess crashed. Use "Goose: Restart" to reconnect.'
      );
    }

    // On every transition into RUNNING (initial start + every restart), attach
    // the `session/update` notification handler to the newly-created client
    // and, if this is a RE-start (initial handshake already done), re-run the
    // ACP handshake so the new subprocess has a live session -- otherwise the
    // first prompt after restart fails with `-32002 Session not found`.
    if (status === ProcessStatus.RUNNING && webviewProvider && subprocessManager) {
      subscribeSessionUpdates(
        webviewProvider,
        subprocessManager,
        responseIdRef,
        acpLogger,
        lastSubscribedClient,
        suppressHistoryReplay
      );

      if (acpInitialized && sessionManager) {
        const provider = webviewProvider;
        const subprocess = subprocessManager;
        const manager = sessionManager;
        void reinitializeAcpOnRestart(
          provider,
          subprocess,
          manager,
          getWorkspaceFolder(),
          acpLogger,
          suppressHistoryReplay
        )
          .then(() => {
            // Safe to open the gate now: session is attached server-side.
            provider.updateStatus(ProcessStatus.RUNNING);
          })
          .catch(err => {
            acpLogger.error('ACP re-init after restart threw:', err);
            provider.updateStatus(ProcessStatus.ERROR);
          });
      }
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

    const clientResult = subprocessManager.getClient();
    if (E.isRight(clientResult)) {
      const client = clientResult.right;

      // Register the history forwarders and session/update subscriber BEFORE
      // the handshake. `initializeAcpSession` calls `session/load`, which
      // replays the full transcript through `manager.onHistoryMessage` -- if
      // no listener is registered yet those chunks are dropped and the
      // webview ends up with an empty chat that secretly points at the
      // restored session on the server side. The webview-side message
      // handlers (send / cancel / session CRUD) are deliberately deferred
      // until AFTER the handshake succeeds so the mock fallback path below
      // doesn't run alongside a duplicate ACP send handler.
      registerHistoryForwarding(webviewProvider, sessionManager, suppressHistoryReplay);
      subscribeSessionUpdates(
        webviewProvider,
        subprocessManager,
        responseIdRef,
        acpLogger,
        lastSubscribedClient,
        suppressHistoryReplay
      );

      const session = await initializeAcpSession(
        client,
        getWorkspaceFolder(),
        sessionManager,
        acpLogger
      );

      if (session) {
        setupAcpWebviewHandlers(
          webviewProvider,
          subprocessManager,
          sessionManager,
          acpLogger,
          responseIdRef
        );
        // Tell the webview which session is now active so its header / session
        // list reflects the restored session instead of showing "New Session"
        // for what is actually a pre-existing conversation on the server.
        webviewProvider.postMessage(
          createSessionsListMessage(sessionManager.getSessions(), session.sessionId)
        );
        acpInitialized = true;
        // Initial activation: broadcast RUNNING now that the handshake is
        // complete. Subsequent RUNNING transitions go through the restart
        // deferral path above.
        webviewProvider.updateStatus(ProcessStatus.RUNNING);
        logger.info('ACP communication enabled');
      } else {
        setupMockStreaming(webviewProvider, logger.child('Mock'));
        // Mock has its own send handler; broadcast RUNNING so the webview
        // enables input.
        webviewProvider.updateStatus(ProcessStatus.RUNNING);
        logger.info('[Mock] Mock streaming enabled (session initialization failed)');
      }
    } else {
      setupMockStreaming(webviewProvider, logger.child('Mock'));
      webviewProvider.updateStatus(ProcessStatus.RUNNING);
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
