/**
 * VS Code command registration for Goose extension.
 */

import * as vscode from 'vscode';
import * as E from 'fp-ts/Either';
import { Logger } from './logger';
import { SubprocessManager } from './subprocessManager';
import { discoverBinary } from './binaryDiscovery';
import { getBinaryDiscoveryConfig } from './config';

/** Dependencies for command registration */
export interface CommandDependencies {
  readonly logger: Logger;
  readonly outputChannel: vscode.OutputChannel;
  readonly subprocessManager: SubprocessManager | null;
  readonly getSubprocessManager: () => SubprocessManager | null;
}

/** Register all Goose commands */
export function registerCommands(
  context: vscode.ExtensionContext,
  deps: CommandDependencies
): void {
  const { logger, outputChannel, getSubprocessManager } = deps;

  context.subscriptions.push(
    vscode.commands.registerCommand('goose.showLogs', () => {
      logger.debug('Show logs command invoked');
      outputChannel.show();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('goose.restart', async () => {
      const manager = getSubprocessManager();
      if (!manager) {
        vscode.window.showWarningMessage('Goose subprocess manager not initialized.');
        return;
      }

      logger.info('Restart command invoked');

      await manager.stop()();

      const binaryResult = discoverBinary(getBinaryDiscoveryConfig());
      if (E.isLeft(binaryResult)) {
        vscode.window.showErrorMessage('Cannot restart: Goose binary not found.');
        return;
      }

      const startResult = await manager.start(binaryResult.right)();
      if (E.isLeft(startResult)) {
        vscode.window.showErrorMessage('Failed to restart Goose subprocess.');
      } else {
        vscode.window.showInformationMessage('Goose restarted successfully.');
      }
    })
  );

  logger.debug('Commands registered: goose.showLogs, goose.restart');
}
