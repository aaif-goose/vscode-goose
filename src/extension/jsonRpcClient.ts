/**
 * JSON-RPC 2.0 client for communication with goose acp subprocess.
 * Uses newline-delimited JSON (ndjson) framing over stdin/stdout.
 */

import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import { Readable, Writable } from 'stream';
import {
  createJsonRpcError,
  createJsonRpcParseError,
  createJsonRpcTimeoutError,
  JsonRpcError,
  JsonRpcParseError,
  JsonRpcTimeoutError,
} from '../shared/errors';
import { JsonRpcNotification, JsonRpcRequest, JsonRpcResponse } from '../shared/types';
import { Logger } from './logger';

const DEFAULT_TIMEOUT_MS = 30000;

/** Configuration for creating a JSON-RPC client */
export interface JsonRpcClientConfig {
  readonly stdin: Writable;
  readonly stdout: Readable;
  readonly logger: Logger;
  readonly timeoutMs?: number;
}

/** Pending request tracking */
interface PendingRequestEntry {
  readonly id: number;
  readonly method: string;
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: JsonRpcError | JsonRpcTimeoutError) => void;
  readonly timer?: ReturnType<typeof setTimeout>;
}

/** Notification callback type */
export type NotificationCallback = (notification: JsonRpcNotification) => void;

/**
 * Per-request options.
 *
 * `timeoutMs` semantics:
 *   - omitted / `undefined`: fall back to the client's constructor default
 *   - `number`: override the default for this single request
 *   - `null`: disable the client-side timeout for this request (never time out)
 */
export interface JsonRpcRequestOptions {
  readonly timeoutMs?: number | null;
}

/** JSON-RPC client interface */
export interface JsonRpcClient {
  readonly request: <T>(
    method: string,
    params?: unknown,
    options?: JsonRpcRequestOptions
  ) => TE.TaskEither<JsonRpcError | JsonRpcTimeoutError, T>;

  readonly notify: (method: string, params?: unknown) => E.Either<JsonRpcParseError, void>;

  readonly onNotification: (callback: NotificationCallback) => void;

  readonly dispose: () => void;
}

/** Create a JSON-RPC client */
export function createJsonRpcClient(config: JsonRpcClientConfig): JsonRpcClient {
  const { stdin, stdout, logger } = config;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let nextId = 1;
  const pendingRequests = new Map<number, PendingRequestEntry>();
  const notificationCallbacks: NotificationCallback[] = [];
  let buffer = '';
  let disposed = false;

  const handleLine = (line: string): void => {
    if (disposed) return;

    logger.debug('Received:', line);

    try {
      const message = JSON.parse(line) as JsonRpcResponse | JsonRpcNotification;

      if ('id' in message && message.id !== undefined) {
        const pending = pendingRequests.get(message.id);
        if (pending) {
          if (pending.timer !== undefined) {
            clearTimeout(pending.timer);
          }
          pendingRequests.delete(message.id);

          const response = message as JsonRpcResponse;
          if (response.error) {
            pending.reject(
              createJsonRpcError(response.error.code, response.error.message, response.error.data)
            );
          } else {
            pending.resolve(response.result);
          }
        } else {
          logger.warn(`Received response for unknown request id: ${message.id}`);
        }
      } else {
        const notification = message as JsonRpcNotification;
        logger.debug(`Notification: ${notification.method}`);
        for (const callback of notificationCallbacks) {
          try {
            callback(notification);
          } catch (err) {
            logger.error('Notification callback error:', err);
          }
        }
      }
    } catch (err) {
      const parseError = err instanceof Error ? err.message : String(err);
      logger.error('JSON parse error:', parseError, 'raw:', line);
    }
  };

  const onData = (chunk: Buffer): void => {
    if (disposed) return;

    buffer += chunk.toString('utf8');
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        handleLine(trimmed);
      }
    }
  };

  stdout.on('data', onData);

  const request = <T>(
    method: string,
    params?: unknown,
    options?: JsonRpcRequestOptions
  ): TE.TaskEither<JsonRpcError | JsonRpcTimeoutError, T> => {
    return () =>
      new Promise(resolve => {
        if (disposed) {
          resolve(E.left(createJsonRpcError(-32000, 'Client disposed')));
          return;
        }

        const id = nextId++;

        const rpcRequest: JsonRpcRequest = {
          jsonrpc: '2.0',
          id,
          method,
          ...(params !== undefined && { params }),
        };

        // Resolve effective timeout:
        //   - explicit `null` -> no timer (request never times out client-side)
        //   - explicit number -> per-call override
        //   - omitted         -> fall back to the client default
        const effectiveTimeout =
          options && 'timeoutMs' in options ? (options.timeoutMs ?? null) : timeoutMs;

        let timer: ReturnType<typeof setTimeout> | undefined;
        if (effectiveTimeout !== null) {
          timer = setTimeout(() => {
            const pending = pendingRequests.get(id);
            if (pending) {
              pendingRequests.delete(id);
              resolve(E.left(createJsonRpcTimeoutError(method, effectiveTimeout, id)));
            }
          }, effectiveTimeout);
        }

        const entry: PendingRequestEntry = {
          id,
          method,
          resolve: value => resolve(E.right(value as T)),
          reject: error => resolve(E.left(error)),
          timer,
        };

        pendingRequests.set(id, entry);

        const requestLine = JSON.stringify(rpcRequest) + '\n';
        logger.debug('Sending:', requestLine.trim());

        stdin.write(requestLine, err => {
          if (err) {
            if (timer !== undefined) {
              clearTimeout(timer);
            }
            pendingRequests.delete(id);
            resolve(E.left(createJsonRpcError(-32000, `Write error: ${err.message}`)));
          }
        });
      });
  };

  const notify = (method: string, params?: unknown): E.Either<JsonRpcParseError, void> => {
    if (disposed) {
      return E.left(createJsonRpcParseError('', 'Client disposed'));
    }

    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      ...(params !== undefined && { params }),
    };

    const notificationLine = JSON.stringify(notification) + '\n';
    logger.debug('Sending notification:', notificationLine.trim());

    try {
      stdin.write(notificationLine);
      return E.right(undefined);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return E.left(createJsonRpcParseError(notificationLine, errorMsg));
    }
  };

  const onNotification = (callback: NotificationCallback): void => {
    notificationCallbacks.push(callback);
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;

    stdout.removeListener('data', onData);

    for (const [id, entry] of pendingRequests) {
      if (entry.timer !== undefined) {
        clearTimeout(entry.timer);
      }
      entry.reject(createJsonRpcError(-32000, 'Client disposed'));
      pendingRequests.delete(id);
    }

    notificationCallbacks.length = 0;
    buffer = '';

    logger.debug('JSON-RPC client disposed');
  };

  return {
    request,
    notify,
    onNotification,
    dispose,
  };
}
