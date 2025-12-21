/**
 * Version checking for Goose binary compatibility.
 * Validates installed version meets minimum requirements.
 */

import { spawn } from 'child_process';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import { createVersionMismatchError, VersionMismatchError } from '../shared/errors';

export const MINIMUM_VERSION = '1.16.0';
const VERSION_CHECK_TIMEOUT_MS = 5000;

export interface VersionCheckResult {
  readonly version: string;
  readonly isCompatible: boolean;
}

/**
 * Parse version string from goose --version output.
 * Handles various formats:
 *   - "goose 1.16.0"
 *   - "1.16.0"
 *   - "v1.16.0"
 *   - "goose version 1.16.0"
 *   - "Goose 1.16.0-beta"
 *
 * @param output - Raw output from goose --version command
 * @returns Parsed version string (e.g., "1.16.0") or null if parsing fails
 */
export function parseVersion(output: string): string | null {
  const trimmed = output.trim();
  if (!trimmed) {
    return null;
  }

  // Match semantic version pattern: major.minor.patch (with optional pre-release suffix)
  // The regex captures the core version numbers before any pre-release suffix like -beta
  const versionRegex = /v?(\d+\.\d+(?:\.\d+)?)/i;
  const match = trimmed.match(versionRegex);

  if (match && match[1]) {
    return match[1];
  }

  return null;
}

/**
 * Parse a version string into numeric segments.
 * Handles versions with 2 or 3 segments (e.g., "1.16" or "1.16.0").
 *
 * @param version - Semantic version string
 * @returns Array of numeric segments [major, minor, patch]
 */
function parseVersionSegments(version: string): readonly [number, number, number] {
  const parts = version.split('.').map(part => parseInt(part, 10) || 0);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/**
 * Compare two semantic versions.
 *
 * @param a - First version string
 * @param b - Second version string
 * @returns Negative if a < b, positive if a > b, zero if equal
 */
export function compareVersions(a: string, b: string): number {
  const [aMajor, aMinor, aPatch] = parseVersionSegments(a);
  const [bMajor, bMinor, bPatch] = parseVersionSegments(b);

  if (aMajor !== bMajor) {
    return aMajor - bMajor;
  }
  if (aMinor !== bMinor) {
    return aMinor - bMinor;
  }
  return aPatch - bPatch;
}

/**
 * Check if a version meets minimum requirements.
 *
 * @param version - Version to check
 * @param minimum - Minimum required version
 * @returns True if version >= minimum
 */
export function meetsMinimumVersion(version: string, minimum: string): boolean {
  return compareVersions(version, minimum) >= 0;
}

/**
 * Check the Goose binary version by executing `goose --version`.
 *
 * @param binaryPath - Path to the goose binary
 * @returns TaskEither containing VersionCheckResult on success, or VersionMismatchError on failure
 */
export function checkVersion(
  binaryPath: string
): TE.TaskEither<VersionMismatchError, VersionCheckResult> {
  return () =>
    new Promise(resolve => {
      let stdout = '';
      let stderr = '';
      let resolved = false;
      let childProcess: ReturnType<typeof spawn> | null = null;

      const cleanup = (): void => {
        if (childProcess && !childProcess.killed) {
          try {
            childProcess.kill('SIGTERM');
          } catch {
            // Process may have already exited
          }
        }
      };

      const resolveWith = (result: E.Either<VersionMismatchError, VersionCheckResult>): void => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(result);
        }
      };

      const timeoutId = setTimeout(() => {
        resolveWith(E.left(createVersionMismatchError('unknown', MINIMUM_VERSION)));
      }, VERSION_CHECK_TIMEOUT_MS);

      try {
        childProcess = spawn(binaryPath, ['--version'], {
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: VERSION_CHECK_TIMEOUT_MS,
        });
      } catch {
        clearTimeout(timeoutId);
        resolveWith(E.left(createVersionMismatchError('unknown', MINIMUM_VERSION)));
        return;
      }

      childProcess.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString('utf8');
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString('utf8');
      });

      childProcess.on('error', () => {
        clearTimeout(timeoutId);
        resolveWith(E.left(createVersionMismatchError('unknown', MINIMUM_VERSION)));
      });

      childProcess.on('close', (_code: number | null) => {
        clearTimeout(timeoutId);

        // Try to parse version from stdout first, then stderr
        const output = stdout || stderr;
        const version = parseVersion(output);

        if (version === null) {
          // Parse failure - treat as incompatible
          resolveWith(E.left(createVersionMismatchError('unknown', MINIMUM_VERSION)));
          return;
        }

        const isCompatible = meetsMinimumVersion(version, MINIMUM_VERSION);

        if (isCompatible) {
          resolveWith(
            E.right({
              version,
              isCompatible: true,
            })
          );
        } else {
          resolveWith(E.left(createVersionMismatchError(version, MINIMUM_VERSION)));
        }
      });
    });
}
