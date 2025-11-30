/**
 * Domain error types for the Goose VS Code extension.
 * Uses discriminated unions for exhaustive error handling.
 */

/** Base structure for all domain errors */
interface BaseError {
  readonly _tag: string;
  readonly message: string;
  readonly timestamp: Date;
}

/** Error when the goose binary cannot be found on the system */
export interface BinaryNotFoundError extends BaseError {
  readonly _tag: 'BinaryNotFoundError';
  readonly searchedPaths: readonly string[];
  readonly platform: NodeJS.Platform;
  readonly installationUrl: string;
}

/** Error when the subprocess fails to spawn */
export interface SubprocessSpawnError extends BaseError {
  readonly _tag: 'SubprocessSpawnError';
  readonly binaryPath: string;
  readonly code: string;
  readonly errno: number;
}

/** Error when the subprocess crashes unexpectedly */
export interface SubprocessCrashError extends BaseError {
  readonly _tag: 'SubprocessCrashError';
  readonly exitCode: number | null;
  readonly signal: string | null;
}

/** Error when a JSON-RPC message cannot be parsed */
export interface JsonRpcParseError extends BaseError {
  readonly _tag: 'JsonRpcParseError';
  readonly rawData: string;
  readonly parseError: string;
}

/** Error when a JSON-RPC request times out */
export interface JsonRpcTimeoutError extends BaseError {
  readonly _tag: 'JsonRpcTimeoutError';
  readonly method: string;
  readonly timeoutMs: number;
  readonly requestId: number;
}

/** Error when the JSON-RPC server returns an error response */
export interface JsonRpcError extends BaseError {
  readonly _tag: 'JsonRpcError';
  readonly code: number;
  readonly data?: unknown;
}

/** Union of all possible Goose domain errors */
export type GooseError =
  | BinaryNotFoundError
  | SubprocessSpawnError
  | SubprocessCrashError
  | JsonRpcParseError
  | JsonRpcTimeoutError
  | JsonRpcError;

const INSTALLATION_URL = 'https://block.github.io/goose';

/** Create a BinaryNotFoundError */
export function createBinaryNotFoundError(
  searchedPaths: readonly string[],
  platform: NodeJS.Platform
): BinaryNotFoundError {
  return {
    _tag: 'BinaryNotFoundError',
    message: `Goose binary not found. Searched: ${searchedPaths.join(', ')}`,
    timestamp: new Date(),
    searchedPaths,
    platform,
    installationUrl: INSTALLATION_URL,
  };
}

/** Create a SubprocessSpawnError */
export function createSubprocessSpawnError(
  binaryPath: string,
  code: string,
  errno: number
): SubprocessSpawnError {
  return {
    _tag: 'SubprocessSpawnError',
    message: `Failed to spawn subprocess at ${binaryPath}: ${code} (errno: ${errno})`,
    timestamp: new Date(),
    binaryPath,
    code,
    errno,
  };
}

/** Create a SubprocessCrashError */
export function createSubprocessCrashError(
  exitCode: number | null,
  signal: string | null
): SubprocessCrashError {
  const reason =
    signal !== null
      ? `signal ${signal}`
      : exitCode !== null
        ? `exit code ${exitCode}`
        : 'unknown reason';
  return {
    _tag: 'SubprocessCrashError',
    message: `Subprocess exited unexpectedly: ${reason}`,
    timestamp: new Date(),
    exitCode,
    signal,
  };
}

/** Create a JsonRpcParseError */
export function createJsonRpcParseError(
  rawData: string,
  parseError: string
): JsonRpcParseError {
  return {
    _tag: 'JsonRpcParseError',
    message: `Failed to parse JSON-RPC message: ${parseError}`,
    timestamp: new Date(),
    rawData,
    parseError,
  };
}

/** Create a JsonRpcTimeoutError */
export function createJsonRpcTimeoutError(
  method: string,
  timeoutMs: number,
  requestId: number
): JsonRpcTimeoutError {
  return {
    _tag: 'JsonRpcTimeoutError',
    message: `JSON-RPC request '${method}' (id: ${requestId}) timed out after ${timeoutMs}ms`,
    timestamp: new Date(),
    method,
    timeoutMs,
    requestId,
  };
}

/** Create a JsonRpcError */
export function createJsonRpcError(
  code: number,
  message: string,
  data?: unknown
): JsonRpcError {
  return {
    _tag: 'JsonRpcError',
    message,
    timestamp: new Date(),
    code,
    data,
  };
}

// ============================================================================
// fp-ts Integration Helpers
// ============================================================================

import * as E from 'fp-ts/Either';

/** Wrap an error in a Left */
export function toLeft<Err>(error: Err): E.Either<Err, never> {
  return E.left(error);
}

/** Wrap a value in a Right */
export function toRight<A>(value: A): E.Either<never, A> {
  return E.right(value);
}

// ============================================================================
// Type Guards
// ============================================================================

/** Check if error is BinaryNotFoundError */
export function isBinaryNotFoundError(
  error: GooseError
): error is BinaryNotFoundError {
  return error._tag === 'BinaryNotFoundError';
}

/** Check if error is SubprocessSpawnError */
export function isSubprocessSpawnError(
  error: GooseError
): error is SubprocessSpawnError {
  return error._tag === 'SubprocessSpawnError';
}

/** Check if error is SubprocessCrashError */
export function isSubprocessCrashError(
  error: GooseError
): error is SubprocessCrashError {
  return error._tag === 'SubprocessCrashError';
}

/** Check if error is JsonRpcParseError */
export function isJsonRpcParseError(
  error: GooseError
): error is JsonRpcParseError {
  return error._tag === 'JsonRpcParseError';
}

/** Check if error is JsonRpcTimeoutError */
export function isJsonRpcTimeoutError(
  error: GooseError
): error is JsonRpcTimeoutError {
  return error._tag === 'JsonRpcTimeoutError';
}

/** Check if error is JsonRpcError */
export function isJsonRpcError(error: GooseError): error is JsonRpcError {
  return error._tag === 'JsonRpcError';
}

// ============================================================================
// Error Formatting
// ============================================================================

/** Format a GooseError into a user-friendly message */
export function formatError(error: GooseError): string {
  switch (error._tag) {
    case 'BinaryNotFoundError':
      return (
        `Goose binary not found.\n` +
        `Searched paths:\n${error.searchedPaths.map((p) => `  - ${p}`).join('\n')}\n` +
        `Install Goose: ${error.installationUrl}`
      );
    case 'SubprocessSpawnError':
      return (
        `Failed to start Goose subprocess.\n` +
        `Binary: ${error.binaryPath}\n` +
        `Error: ${error.code} (errno: ${error.errno})`
      );
    case 'SubprocessCrashError': {
      const reason =
        error.signal !== null
          ? `signal ${error.signal}`
          : error.exitCode !== null
            ? `exit code ${error.exitCode}`
            : 'unknown reason';
      return `Goose subprocess crashed: ${reason}`;
    }
    case 'JsonRpcParseError':
      return `Invalid response from Goose: ${error.parseError}`;
    case 'JsonRpcTimeoutError':
      return `Request '${error.method}' timed out after ${error.timeoutMs}ms`;
    case 'JsonRpcError':
      return `Goose error (${error.code}): ${error.message}`;
  }
}
