/**
 * Mock utilities for stream-based testing
 * Used by JSON-RPC client tests and subprocess integration tests
 */

import { Readable, Writable } from 'stream';

/**
 * Creates mock stdin/stdout streams for testing subprocess communication.
 * Captures written data and allows pushing responses to simulate subprocess output.
 *
 * @example
 * ```typescript
 * const { stdin, stdout, written, pushResponse, close } = createMockStreams();
 *
 * // Write to stdin (simulates extension -> subprocess)
 * stdin.write('{"jsonrpc":"2.0","method":"test"}');
 *
 * // Check what was written
 * expect(written).toContain('{"jsonrpc":"2.0","method":"test"}');
 *
 * // Push response (simulates subprocess -> extension)
 * pushResponse('{"jsonrpc":"2.0","result":"ok"}');
 *
 * // Close stream when done
 * close();
 * ```
 */
export function createMockStreams(): MockStreams {
  const written: string[] = [];

  const stdin = new Writable({
    write(chunk, _encoding, callback) {
      written.push(chunk.toString());
      callback();
    },
  });

  const stdout = new Readable({
    read() {
      // No-op: data is pushed via pushResponse
    },
  });

  return {
    stdin,
    stdout,
    written,
    pushResponse: (data: string): void => {
      stdout.push(data + '\n');
    },
    close: (): void => {
      stdout.push(null);
    },
  };
}

/**
 * Mock streams interface returned by createMockStreams
 */
export interface MockStreams {
  /** Writable stream simulating subprocess stdin */
  readonly stdin: Writable;
  /** Readable stream simulating subprocess stdout */
  readonly stdout: Readable;
  /** Array of all strings written to stdin */
  readonly written: string[];
  /** Push a response line to stdout (adds newline automatically) */
  pushResponse: (data: string) => void;
  /** Signal end of stdout stream */
  close: () => void;
}
