/**
 * Source-tagged logger for the Goose extension.
 * Uses VS Code OutputChannel for log output.
 */

import * as vscode from 'vscode';
import { LogLevel, logLevelToString } from '../shared/types';

/** Logger interface with source tagging support */
export interface Logger {
  readonly debug: (message: string, ...args: unknown[]) => void;
  readonly info: (message: string, ...args: unknown[]) => void;
  readonly warn: (message: string, ...args: unknown[]) => void;
  readonly error: (message: string, ...args: unknown[]) => void;
  readonly child: (source: string) => Logger;
  readonly setLevel: (level: LogLevel) => void;
}

/** Format a timestamp for log messages */
function formatTimestamp(date: Date): string {
  return date.toISOString().slice(11, 23);
}

/** Format additional arguments for logging */
function formatArgs(args: unknown[]): string {
  if (args.length === 0) return '';
  return (
    ' ' +
    args
      .map((arg) => {
        if (typeof arg === 'string') return arg;
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      })
      .join(' ')
  );
}

/** Create a logger that writes to a VS Code OutputChannel */
export function createLogger(
  outputChannel: vscode.OutputChannel,
  initialLevel: LogLevel,
  source?: string
): Logger {
  let currentLevel = initialLevel;

  const log = (level: LogLevel, message: string, ...args: unknown[]): void => {
    if (level < currentLevel) return;

    const timestamp = formatTimestamp(new Date());
    const levelStr = logLevelToString(level);
    const sourceStr = source ? `[${source}] ` : '';
    const argsStr = formatArgs(args);

    outputChannel.appendLine(
      `${timestamp} [${levelStr}] ${sourceStr}${message}${argsStr}`
    );
  };

  return {
    debug: (message: string, ...args: unknown[]) =>
      log(LogLevel.DEBUG, message, ...args),
    info: (message: string, ...args: unknown[]) =>
      log(LogLevel.INFO, message, ...args),
    warn: (message: string, ...args: unknown[]) =>
      log(LogLevel.WARN, message, ...args),
    error: (message: string, ...args: unknown[]) =>
      log(LogLevel.ERROR, message, ...args),
    child: (childSource: string) =>
      createLogger(
        outputChannel,
        currentLevel,
        source ? `${source}:${childSource}` : childSource
      ),
    setLevel: (level: LogLevel) => {
      currentLevel = level;
    },
  };
}
