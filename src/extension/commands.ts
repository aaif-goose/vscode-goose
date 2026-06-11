/**
 * VS Code command registration for Goose extension.
 */

import * as E from 'fp-ts/Either';
import * as path from 'path';
import * as vscode from 'vscode';
import { ContextChip } from '../shared/contextTypes';
import { formatError } from '../shared/errors';
import { createAddContextChipMessage, createFocusChatInputMessage } from '../shared/messages';
import { ProcessStatus } from '../shared/types';
import { discoverBinary } from './binaryDiscovery';
import { getBinaryDiscoveryConfig } from './config';
import { Logger } from './logger';
import { SubprocessManager } from './subprocessManager';
import { WebviewProvider } from './webviewProvider';

/** Dependencies for command registration */
export interface CommandDependencies {
  readonly logger: Logger;
  readonly outputChannel: vscode.OutputChannel;
  readonly subprocessManager: SubprocessManager | null;
  readonly getSubprocessManager: () => SubprocessManager | null;
  /**
   * Re-runs the full bootstrap (discovery -> version gate -> subprocess
   * start). Used by `goose.restart` to recover when activation blocked
   * before a subprocess manager was created.
   */
  readonly runBootstrap: () => Promise<void>;
}

/** Register all Goose commands */
export function registerCommands(
  context: vscode.ExtensionContext,
  deps: CommandDependencies
): void {
  const { logger, outputChannel, getSubprocessManager, runBootstrap } = deps;

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
        // Activation blocked before a subprocess manager existed (e.g. binary
        // not found or version gate failed). Re-run the bootstrap so the user
        // can recover without reloading the window.
        logger.info('Restart command invoked without a subprocess manager - re-running bootstrap');
        await runBootstrap();

        const recovered = getSubprocessManager();
        if (recovered && recovered.getStatus() === ProcessStatus.RUNNING) {
          vscode.window.showInformationMessage('Goose restarted successfully.');
        } else if (!recovered) {
          // Bootstrap blocked again; the chat panel names the specific reason.
          vscode.window.showWarningMessage(
            'Goose could not start. Check the Goose panel for details.'
          );
        }
        // Manager exists but is not RUNNING: the bootstrap's spawn-failure
        // path already showed its own error toast.
        return;
      }

      logger.info('Restart command invoked');

      await manager.stop()();

      const binaryResult = discoverBinary(getBinaryDiscoveryConfig());
      if (E.isLeft(binaryResult)) {
        vscode.window.showErrorMessage(
          `Cannot restart: ${formatError(binaryResult.left).replace(/\n\s*/g, ' ')}`
        );
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
