/**
 * WebviewViewProvider for the Goose chat panel.
 * Manages webview lifecycle, message queue, and HTML generation with CSP.
 */

import * as vscode from 'vscode';
import { Logger } from './logger';
import {
  AnyWebviewMessage,
  isWebviewReadyMessage,
  createStatusUpdateMessage,
  createVersionStatusMessage,
  VersionStatusPayload,
} from '../shared/messages';
import { ProcessStatus } from '../shared/types';

/** Configuration for creating a webview provider */
export interface WebviewProviderConfig {
  readonly extensionUri: vscode.Uri;
  readonly logger: Logger;
}

/** Message callback type */
export type MessageCallback = (message: AnyWebviewMessage) => void;

/** Extended WebviewViewProvider interface with message methods */
export interface WebviewProvider extends vscode.WebviewViewProvider {
  readonly postMessage: (message: AnyWebviewMessage) => void;
  readonly onMessage: (callback: MessageCallback) => vscode.Disposable;
  readonly updateStatus: (status: ProcessStatus) => void;
  readonly updateVersionStatus: (payload: VersionStatusPayload) => void;
  readonly waitForReady: () => Promise<void>;
}

/** Create a webview provider */
export function createWebviewProvider(config: WebviewProviderConfig): WebviewProvider {
  const { extensionUri, logger } = config;

  let view: vscode.WebviewView | null = null;
  let isReady = false;
  const messageQueue: AnyWebviewMessage[] = [];
  const messageCallbacks: MessageCallback[] = [];
  const readyCallbacks: (() => void)[] = [];

  // Track last known state to re-send on webview reconnect
  let lastStatus: ProcessStatus | null = null;
  let lastVersionStatus: VersionStatusPayload | null = null;

  const flushQueue = (): void => {
    if (!view || !isReady) return;

    logger.debug(`Flushing ${messageQueue.length} queued messages`);
    while (messageQueue.length > 0) {
      const message = messageQueue.shift();
      if (message) {
        view.webview.postMessage(message);
      }
    }
  };

  const postMessage = (message: AnyWebviewMessage): void => {
    if (!view) {
      logger.debug('Webview not available, queueing message');
      messageQueue.push(message);
      return;
    }

    if (!isReady) {
      logger.debug(`Queueing message: ${message.type}`);
      messageQueue.push(message);
      return;
    }

    view.webview.postMessage(message);
  };

  const onMessage = (callback: MessageCallback): vscode.Disposable => {
    messageCallbacks.push(callback);
    return {
      dispose: () => {
        const index = messageCallbacks.indexOf(callback);
        if (index > -1) {
          messageCallbacks.splice(index, 1);
        }
      },
    };
  };

  const updateStatus = (status: ProcessStatus): void => {
    lastStatus = status;
    postMessage(createStatusUpdateMessage(status));
  };

  const updateVersionStatus = (payload: VersionStatusPayload): void => {
    lastVersionStatus = payload;
    postMessage(
      createVersionStatusMessage(payload.status, payload.minimumVersion, {
        detectedVersion: payload.detectedVersion,
        installUrl: payload.installUrl,
        updateUrl: payload.updateUrl,
      })
    );
  };

  const resendState = (): void => {
    // Re-send last known status when webview reconnects
    if (lastVersionStatus) {
      logger.debug('Re-sending version status to reconnected webview');
      postMessage(
        createVersionStatusMessage(lastVersionStatus.status, lastVersionStatus.minimumVersion, {
          detectedVersion: lastVersionStatus.detectedVersion,
          installUrl: lastVersionStatus.installUrl,
          updateUrl: lastVersionStatus.updateUrl,
        })
      );
    } else if (lastStatus) {
      logger.debug('Re-sending process status to reconnected webview');
      postMessage(createStatusUpdateMessage(lastStatus));
    }
  };

  const handleMessage = (message: unknown): void => {
    logger.debug('Received message from webview:', message);

    if (isWebviewReadyMessage(message)) {
      logger.info('Webview ready signal received');
      isReady = true;
      flushQueue();
      resendState();
      // Resolve any pending waitForReady promises
      while (readyCallbacks.length > 0) {
        const cb = readyCallbacks.shift();
        cb?.();
      }
      return;
    }

    for (const callback of messageCallbacks) {
      try {
        callback(message as AnyWebviewMessage);
      } catch (err) {
        logger.error('Message callback error:', err);
      }
    }
  };

  const waitForReady = (): Promise<void> => {
    if (isReady) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      readyCallbacks.push(resolve);
    });
  };

  const getNonce = (): string => {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  };

  const getWebviewContent = (webview: vscode.Webview): string => {
    const nonce = getNonce();

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'main.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'styles.css')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <link href="${styleUri}" rel="stylesheet">
  <title>Goose</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  };

  const resolveWebviewView = (
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void => {
    view = webviewView;
    isReady = false;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist', 'webview')],
    };

    webviewView.webview.html = getWebviewContent(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(handleMessage);

    webviewView.onDidDispose(() => {
      logger.debug('Webview disposed');
      view = null;
      isReady = false;
    });

    logger.info('Webview view resolved');
  };

  return {
    resolveWebviewView,
    postMessage,
    onMessage,
    updateStatus,
    updateVersionStatus,
    waitForReady,
  };
}
