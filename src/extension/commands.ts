/**
 * VS Code command registration for Goose extension.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as E from 'fp-ts/Either';
import { Logger } from './logger';
import { SubprocessManager } from './subprocessManager';
import { WebviewProvider } from './webviewProvider';
import { discoverBinary } from './binaryDiscovery';
import { getBinaryDiscoveryConfig } from './config';
import { ContextChip } from '../shared/contextTypes';
import { createAddContextChipMessage, createFocusChatInputMessage } from '../shared/messages';

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

/** Generate a unique chip ID */
function generateChipId(): string {
  return `chip-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/** Dependencies for context commands */
export interface ContextCommandDependencies {
  readonly logger: Logger;
  readonly webviewProvider: WebviewProvider;
  readonly getSessionManager: () => import('./sessionManager').SessionManager | null;
}

/** Register context-related commands (selection to chat) */
export function registerContextCommands(
  context: vscode.ExtensionContext,
  deps: ContextCommandDependencies
): void {
  const { logger, webviewProvider, getSessionManager } = deps;

  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      'goose.sendSelectionToChat',
      async (editor: vscode.TextEditor) => {
        const selection = editor.selection;
        const document = editor.document;

        // Reveal the Goose panel
        await vscode.commands.executeCommand('goose.chatView.focus');

        // Ensure there's an active session
        const sessionManager = getSessionManager();
        if (sessionManager && !sessionManager.getActiveSession()) {
          logger.info('No active session, creating new one for context chip');
          const result = await sessionManager.createSession()();
          if (E.isLeft(result)) {
            logger.error('Failed to create session for context chip:', result.left);
          }
        }

        // Wait for webview to be ready before sending chip
        await webviewProvider.waitForReady();

        const chip: ContextChip = {
          id: generateChipId(),
          filePath: document.uri.fsPath,
          fileName: path.basename(document.uri.fsPath),
          languageId: document.languageId,
          range: selection.isEmpty
            ? undefined
            : {
                startLine: selection.start.line + 1,
                endLine: selection.end.line + 1,
              },
        };

        webviewProvider.postMessage(createAddContextChipMessage(chip));
        webviewProvider.postMessage(createFocusChatInputMessage());

        logger.info(
          `Added context chip: ${chip.fileName}${chip.range ? `:${chip.range.startLine}-${chip.range.endLine}` : ''}`
        );
      }
    )
  );

  logger.debug('Context commands registered: goose.sendSelectionToChat');
}
