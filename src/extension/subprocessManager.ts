/**
 * Subprocess manager for the goose acp process.
 * Handles spawning, lifecycle events, and graceful shutdown.
 */

import { ChildProcess, spawn } from 'child_process';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import {
  SubprocessSpawnError,
  SubprocessCrashError,
  createSubprocessSpawnError,
  createSubprocessCrashError,
} from '../shared/errors';
import { ProcessStatus } from '../shared/types';
import { Logger } from './logger';
import { JsonRpcClient, createJsonRpcClient } from './jsonRpcClient';

const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 5000;

/** Configuration for creating a subprocess manager */
export interface SubprocessManagerConfig {
  readonly logger: Logger;
  readonly workingDirectory: string;
}

/** Status change callback type */
export type StatusChangeCallback = (status: ProcessStatus) => void;

/** Subprocess manager interface */
export interface SubprocessManager {
  readonly getStatus: () => ProcessStatus;
  readonly start: (binaryPath: string) => TE.TaskEither<SubprocessSpawnError, void>;
  readonly stop: () => TE.TaskEither<never, void>;
  readonly getClient: () => E.Either<SubprocessCrashError, JsonRpcClient>;
  readonly onStatusChange: (callback: StatusChangeCallback) => void;
}

/** Create a subprocess manager */
export function createSubprocessManager(
  config: SubprocessManagerConfig
): SubprocessManager {
  const { logger, workingDirectory } = config;

  let status: ProcessStatus = ProcessStatus.STOPPED;
  let process: ChildProcess | null = null;
  let client: JsonRpcClient | null = null;
  let lastError: SubprocessCrashError | null = null;
  const statusChangeCallbacks: StatusChangeCallback[] = [];

  const setStatus = (newStatus: ProcessStatus): void => {
    if (status !== newStatus) {
      status = newStatus;
      logger.info(`Status changed: ${newStatus}`);
      for (const callback of statusChangeCallbacks) {
        try {
          callback(newStatus);
        } catch (err) {
          logger.error('Status change callback error:', err);
        }
      }
    }
  };

  const getStatus = (): ProcessStatus => status;

  const start = (binaryPath: string): TE.TaskEither<SubprocessSpawnError, void> => {
    return () =>
      new Promise((resolve) => {
        if (process !== null) {
          logger.warn('Subprocess already running, stopping first');
          stop()().then(() => {
            doStart(binaryPath, resolve);
          });
        } else {
          doStart(binaryPath, resolve);
        }
      });
  };

  const doStart = (
    binaryPath: string,
    resolve: (result: E.Either<SubprocessSpawnError, void>) => void
  ): void => {
    setStatus(ProcessStatus.STARTING);
    lastError = null;

    logger.info(`Spawning: ${binaryPath} acp`);
    logger.debug(`Working directory: ${workingDirectory}`);

    try {
      process = spawn(binaryPath, ['acp'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: workingDirectory,
        env: globalThis.process.env,
      });
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      setStatus(ProcessStatus.ERROR);
      resolve(
        E.left(
          createSubprocessSpawnError(
            binaryPath,
            error.code ?? 'UNKNOWN',
            error.errno ?? -1
          )
        )
      );
      return;
    }

    let hasResolved = false;

    const onSpawnError = (err: NodeJS.ErrnoException): void => {
      logger.error('Spawn error:', err.message);
      setStatus(ProcessStatus.ERROR);

      if (!hasResolved) {
        hasResolved = true;
        resolve(
          E.left(
            createSubprocessSpawnError(
              binaryPath,
              err.code ?? 'UNKNOWN',
              err.errno ?? -1
            )
          )
        );
      }
    };

    const onExit = (code: number | null, signal: string | null): void => {
      logger.info(`Process exited: code=${code}, signal=${signal}`);

      if (client) {
        client.dispose();
        client = null;
      }

      process = null;

      if (status === ProcessStatus.RUNNING) {
        lastError = createSubprocessCrashError(code, signal);
        setStatus(ProcessStatus.ERROR);
      } else {
        setStatus(ProcessStatus.STOPPED);
      }
    };

    process.on('error', onSpawnError);
    process.on('exit', onExit);

    if (process.stderr) {
      process.stderr.on('data', (data: Buffer) => {
        const lines = data.toString('utf8').trim().split('\n');
        for (const line of lines) {
          if (line) {
            logger.warn(`[stderr] ${line}`);
          }
        }
      });
    }

    if (process.stdin && process.stdout) {
      client = createJsonRpcClient({
        stdin: process.stdin,
        stdout: process.stdout,
        logger: logger.child('JsonRpc'),
        timeoutMs: 30000,
      });

      setStatus(ProcessStatus.RUNNING);
      logger.info(`Subprocess started: pid=${process.pid}`);

      if (!hasResolved) {
        hasResolved = true;
        resolve(E.right(undefined));
      }
    } else {
      logger.error('Failed to get stdin/stdout from process');
      setStatus(ProcessStatus.ERROR);

      if (!hasResolved) {
        hasResolved = true;
        resolve(
          E.left(
            createSubprocessSpawnError(binaryPath, 'NO_STDIO', -1)
          )
        );
      }
    }
  };

  const stop = (): TE.TaskEither<never, void> => {
    return () =>
      new Promise((resolve) => {
        if (process === null) {
          logger.debug('No process to stop');
          resolve(E.right(undefined));
          return;
        }

        logger.info('Stopping subprocess...');

        if (client) {
          client.dispose();
          client = null;
        }

        const currentProcess = process;
        let killed = false;

        const forceKillTimer = setTimeout(() => {
          if (!killed && currentProcess.pid) {
            logger.warn('Graceful shutdown timeout, sending SIGKILL');
            try {
              currentProcess.kill('SIGKILL');
            } catch {
              // Process may have already exited
            }
          }
        }, GRACEFUL_SHUTDOWN_TIMEOUT_MS);

        const cleanup = (): void => {
          killed = true;
          clearTimeout(forceKillTimer);
          process = null;
          setStatus(ProcessStatus.STOPPED);
          resolve(E.right(undefined));
        };

        currentProcess.once('exit', cleanup);

        try {
          currentProcess.kill('SIGTERM');
        } catch {
          cleanup();
        }
      });
  };

  const getClient = (): E.Either<SubprocessCrashError, JsonRpcClient> => {
    if (client && status === ProcessStatus.RUNNING) {
      return E.right(client);
    }

    if (lastError) {
      return E.left(lastError);
    }

    return E.left(createSubprocessCrashError(null, null));
  };

  const onStatusChange = (callback: StatusChangeCallback): void => {
    statusChangeCallbacks.push(callback);
  };

  return {
    getStatus,
    start,
    stop,
    getClient,
    onStatusChange,
  };
}
