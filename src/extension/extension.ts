import * as vscode from 'vscode';
import * as E from 'fp-ts/Either';
import { createLogger, Logger } from './logger';
import { getLogLevel, getBinaryDiscoveryConfig, onConfigChange, affectsSetting } from './config';
import { discoverBinary } from './binaryDiscovery';
import { formatError, isBinaryNotFoundError, isSubprocessSpawnError } from '../shared/errors';
import { createSubprocessManager, SubprocessManager } from './subprocessManager';
import { ProcessStatus } from '../shared/types';

let logger: Logger | null = null;
let subprocessManager: SubprocessManager | null = null;

function getWorkspaceFolder(): string {
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return folders[0].uri.fsPath;
  }
  return process.cwd();
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const outputChannel = vscode.window.createOutputChannel('Goose');
  logger = createLogger(outputChannel, getLogLevel());

  logger.info('Goose extension activating...');

  const binaryResult = discoverBinary(getBinaryDiscoveryConfig());

  if (E.isLeft(binaryResult)) {
    const error = binaryResult.left;
    logger.error('Binary discovery failed:', formatError(error));

    if (isBinaryNotFoundError(error)) {
      vscode.window
        .showErrorMessage(
          'Goose binary not found. Please install Goose or configure goose.binaryPath.',
          'Install Goose',
          'Open Settings'
        )
        .then((selection) => {
          if (selection === 'Install Goose') {
            vscode.env.openExternal(vscode.Uri.parse(error.installationUrl));
          } else if (selection === 'Open Settings') {
            vscode.commands.executeCommand(
              'workbench.action.openSettings',
              'goose.binaryPath'
            );
          }
        });
    }

    logger.info('Goose extension activated (binary not found - limited functionality).');
    registerCommands(context, outputChannel);
    registerWebviewProvider(context);
    return;
  }

  const binaryPath = binaryResult.right;
  logger.info(`Found goose binary at: ${binaryPath}`);

  subprocessManager = createSubprocessManager({
    logger: logger.child('Subprocess'),
    workingDirectory: getWorkspaceFolder(),
  });

  subprocessManager.onStatusChange((status) => {
    logger?.info(`Subprocess status: ${status}`);
    if (status === ProcessStatus.ERROR) {
      vscode.window.showWarningMessage('Goose subprocess crashed. Use "Goose: Restart" to reconnect.');
    }
  });

  const startResult = await subprocessManager.start(binaryPath)();

  if (E.isLeft(startResult)) {
    const error = startResult.left;
    logger.error('Failed to start subprocess:', formatError(error));

    if (isSubprocessSpawnError(error)) {
      vscode.window.showErrorMessage(
        `Failed to start Goose: ${error.code}. Check the Goose output for details.`
      );
    }
  } else {
    logger.info('Subprocess started successfully');
  }

  registerCommands(context, outputChannel);
  registerWebviewProvider(context);
  registerConfigChangeHandler(context);

  logger.info('Goose extension activated.');
}

function registerCommands(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('goose.showLogs', () => {
      outputChannel.show();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('goose.restart', async () => {
      if (!subprocessManager) {
        vscode.window.showWarningMessage('Goose subprocess manager not initialized.');
        return;
      }

      logger?.info('Restart command invoked');

      await subprocessManager.stop()();

      const binaryResult = discoverBinary(getBinaryDiscoveryConfig());
      if (E.isLeft(binaryResult)) {
        vscode.window.showErrorMessage('Cannot restart: Goose binary not found.');
        return;
      }

      const startResult = await subprocessManager.start(binaryResult.right)();
      if (E.isLeft(startResult)) {
        vscode.window.showErrorMessage('Failed to restart Goose subprocess.');
      } else {
        vscode.window.showInformationMessage('Goose restarted successfully.');
      }
    })
  );
}

function registerWebviewProvider(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('goose.chatView', {
      resolveWebviewView(webviewView: vscode.WebviewView) {
        webviewView.webview.options = {
          enableScripts: true,
          localResourceRoots: [context.extensionUri],
        };
        webviewView.webview.html = getWebviewContent();
      },
    })
  );
}

function registerConfigChangeHandler(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    onConfigChange((e) => {
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

function getWebviewContent(): string {
  const status = subprocessManager?.getStatus() ?? ProcessStatus.STOPPED;
  const statusText = status === ProcessStatus.RUNNING ? '🟢 Connected' : '🔴 Disconnected';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Goose</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 200px;
    }
    h1 {
      color: var(--vscode-textLink-foreground);
      margin-bottom: 16px;
    }
    p {
      color: var(--vscode-descriptionForeground);
    }
    .status {
      margin-top: 12px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <h1>Hello Goose</h1>
  <p>ACP Foundation Ready</p>
  <p class="status">${statusText}</p>
</body>
</html>`;
}
