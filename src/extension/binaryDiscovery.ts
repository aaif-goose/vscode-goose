/**
 * Cross-platform goose binary discovery.
 * Searches user settings, PATH, and platform-specific installation locations.
 */

import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import * as fs from 'fs';
import * as path from 'path';
import { BinaryNotFoundError, createBinaryNotFoundError, toLeft, toRight } from '../shared/errors';
import { BinaryDiscoveryConfig } from '../shared/types';

// ============================================================================
// Platform-Specific Search Paths
// ============================================================================

const SEARCH_PATHS: Partial<Record<NodeJS.Platform, readonly string[]>> = {
  darwin: [
    '/Applications/Goose.app/Contents/MacOS/goose',
    '~/.local/bin/goose',
    '/usr/local/bin/goose',
    '/opt/homebrew/bin/goose',
  ],
  win32: ['%LOCALAPPDATA%\\Goose\\goose.exe', '%PROGRAMFILES%\\Goose\\goose.exe'],
  linux: [
    '~/.local/bin/goose',
    '/usr/local/bin/goose',
    '/usr/bin/goose',
    '/usr/share/goose/bin/goose',
  ],
};

// ============================================================================
// Path Expansion
// ============================================================================

/** Expand ~ and environment variables in a path */
export function expandPath(pathStr: string, homeDir: string, env: NodeJS.ProcessEnv): string {
  let expanded = pathStr;

  if (expanded.startsWith('~')) {
    expanded = path.join(homeDir, expanded.slice(1));
  }

  expanded = expanded.replace(/%([^%]+)%/g, (_, varName: string) => {
    return env[varName] ?? '';
  });

  return expanded;
}

// ============================================================================
// Path Checking
// ============================================================================

/** Check if a file exists and is executable */
export function checkPathExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// PATH Search
// ============================================================================

/** Find goose binary in PATH environment variable */
export function findInPath(env: NodeJS.ProcessEnv): string | undefined {
  const pathEnv = env.PATH ?? env.Path ?? '';
  const pathSeparator = process.platform === 'win32' ? ';' : ':';
  const executableName = process.platform === 'win32' ? 'goose.exe' : 'goose';

  for (const dir of pathEnv.split(pathSeparator)) {
    if (!dir) continue;
    const fullPath = path.join(dir, executableName);
    if (checkPathExists(fullPath)) {
      return fullPath;
    }
  }

  return undefined;
}

// ============================================================================
// Platform Path Search
// ============================================================================

/** Find goose binary in platform-specific paths */
export function findInPlatformPaths(
  platform: NodeJS.Platform,
  homeDir: string,
  env: NodeJS.ProcessEnv
): string | undefined {
  const paths = SEARCH_PATHS[platform] ?? [];

  for (const pathStr of paths) {
    const expanded = expandPath(pathStr, homeDir, env);
    if (checkPathExists(expanded)) {
      return expanded;
    }
  }

  return undefined;
}

// ============================================================================
// Main Discovery Function
// ============================================================================

/** Discover the goose binary path */
export function discoverBinary(
  config: BinaryDiscoveryConfig
): E.Either<BinaryNotFoundError, string> {
  const searchedPaths: string[] = [];

  return pipe(config.userConfiguredPath, userPath => {
    if (userPath !== undefined) {
      const expanded = expandPath(userPath, config.homeDir, config.env);
      searchedPaths.push(expanded);
      if (checkPathExists(expanded)) {
        return toRight(expanded);
      }
    }

    const pathResult = findInPath(config.env);
    if (pathResult !== undefined) {
      return toRight(pathResult);
    }

    const platformPaths = SEARCH_PATHS[config.platform] ?? [];
    for (const pathStr of platformPaths) {
      const expanded = expandPath(pathStr, config.homeDir, config.env);
      searchedPaths.push(expanded);
    }

    const platformResult = findInPlatformPaths(config.platform, config.homeDir, config.env);
    if (platformResult !== undefined) {
      return toRight(platformResult);
    }

    return toLeft(createBinaryNotFoundError(searchedPaths, config.platform));
  });
}

/** Get all search paths that would be checked (for error messages) */
export function getAllSearchPaths(config: BinaryDiscoveryConfig): readonly string[] {
  const paths: string[] = [];

  if (config.userConfiguredPath !== undefined) {
    paths.push(expandPath(config.userConfiguredPath, config.homeDir, config.env));
  }

  paths.push('PATH environment variable');

  const platformPaths = SEARCH_PATHS[config.platform] ?? [];
  for (const pathStr of platformPaths) {
    paths.push(expandPath(pathStr, config.homeDir, config.env));
  }

  return paths;
}
