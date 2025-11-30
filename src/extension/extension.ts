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
import { ProcessStatus } from '../shared/types';

let logger: Logger | null = null;
let subprocessManager: SubprocessManager | null = null;
let webviewProvider: WebviewProvider | null = null;

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
  } else {
    logger.info('Subprocess started successfully');
    webviewProvider.updateStatus(ProcessStatus.RUNNING);
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
