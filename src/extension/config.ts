/**
 * VS Code configuration reader for Goose extension settings.
 */

import { pipe } from 'fp-ts/function';
import * as O from 'fp-ts/Option';
import * as os from 'os';
import * as vscode from 'vscode';
import { BinaryDiscoveryConfig, LogLevel, parseLogLevel } from '../shared/types';

const CONFIG_SECTION = 'goose';

/** Get the configured goose binary path, or None if not set */
export function getGooseBinaryPath(): O.Option<string> {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const path = config.get<string>('binaryPath');
  return pipe(
    path,
    O.fromNullable,
    O.filter(p => p.length > 0)
  );
}

/** Get the configured log level, defaulting to INFO */
export function getLogLevel(): LogLevel {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const level = config.get<string>('logLevel', 'info');
  return parseLogLevel(level);
}

/** Get the binary discovery configuration */
export function getBinaryDiscoveryConfig(): BinaryDiscoveryConfig {
  return {
    userConfiguredPath: pipe(getGooseBinaryPath(), O.toUndefined),
    platform: process.platform,
    env: process.env,
    homeDir: os.homedir(),
  };
}

/** Configuration change listener callback type */
export type ConfigChangeCallback = (e: vscode.ConfigurationChangeEvent) => void;

/** Register a listener for configuration changes */
export function onConfigChange(callback: ConfigChangeCallback): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration(CONFIG_SECTION)) {
      callback(e);
    }
  });
}

/** Check if a specific setting was changed */
export function affectsSetting(e: vscode.ConfigurationChangeEvent, setting: string): boolean {
  return e.affectsConfiguration(`${CONFIG_SECTION}.${setting}`);
}
