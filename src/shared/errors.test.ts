import { describe, expect, test } from 'bun:test';
import {
  createBinaryNotFoundError,
  createJsonRpcError,
  createJsonRpcParseError,
  createJsonRpcTimeoutError,
  createSubprocessCrashError,
  createSubprocessSpawnError,
  createVersionMismatchError,
  formatError,
} from './errors';

describe('formatError', () => {
  describe('BinaryNotFoundError', () => {
    test('includes searched paths', () => {
      const error = createBinaryNotFoundError(['/usr/bin/goose', '/opt/goose'], 'darwin');
      const formatted = formatError(error);

      expect(formatted).toContain('/usr/bin/goose');
      expect(formatted).toContain('/opt/goose');
    });

    test('includes install URL', () => {
      const error = createBinaryNotFoundError(['/path/to/goose'], 'darwin');
      const formatted = formatError(error);

      expect(formatted).toContain('https://');
      expect(formatted).toContain('block.github.io/goose');
    });

    test('formats paths as bullet list', () => {
      const error = createBinaryNotFoundError(['/path/a', '/path/b'], 'darwin');
      const formatted = formatError(error);

      expect(formatted).toContain('- /path/a');
      expect(formatted).toContain('- /path/b');
    });
  });

  describe('SubprocessSpawnError', () => {
    test('shows binary path', () => {
      const error = createSubprocessSpawnError('/usr/local/bin/goose', 'ENOENT', -2);
      const formatted = formatError(error);

      expect(formatted).toContain('/usr/local/bin/goose');
    });

    test('shows error code', () => {
      const error = createSubprocessSpawnError('/path/to/goose', 'EACCES', 13);
      const formatted = formatError(error);

      expect(formatted).toContain('EACCES');
      expect(formatted).toContain('13');
    });
  });

  describe('SubprocessCrashError', () => {
    test('shows signal when signal is present', () => {
      const error = createSubprocessCrashError(null, 'SIGKILL');
      const formatted = formatError(error);

      expect(formatted).toContain('SIGKILL');
      expect(formatted).toContain('signal');
    });

    test('shows exit code when no signal present', () => {
      const error = createSubprocessCrashError(1, null);
      const formatted = formatError(error);

      expect(formatted).toContain('exit code 1');
    });

    test('prioritizes signal over exit code', () => {
      const error = createSubprocessCrashError(1, 'SIGTERM');
      const formatted = formatError(error);

      expect(formatted).toContain('SIGTERM');
      expect(formatted).not.toContain('exit code');
    });

    test('shows unknown reason when neither signal nor exit code', () => {
      const error = createSubprocessCrashError(null, null);
      const formatted = formatError(error);

      expect(formatted).toContain('unknown reason');
    });
  });

  describe('JsonRpcParseError', () => {
    test('shows parse error message', () => {
      const error = createJsonRpcParseError('invalid json data', 'Unexpected token');
      const formatted = formatError(error);

      expect(formatted).toContain('Unexpected token');
    });

    test('indicates invalid response', () => {
      const error = createJsonRpcParseError('{}', 'Missing required field');
      const formatted = formatError(error);

      expect(formatted).toContain('Invalid response');
    });
  });

  describe('JsonRpcTimeoutError', () => {
    test('shows method name', () => {
      const error = createJsonRpcTimeoutError('session/prompt', 30000, 42);
      const formatted = formatError(error);

      expect(formatted).toContain('session/prompt');
    });

    test('shows timeout duration', () => {
      const error = createJsonRpcTimeoutError('initialize', 5000, 1);
      const formatted = formatError(error);

      expect(formatted).toContain('5000ms');
    });
  });

  describe('JsonRpcError', () => {
    test('shows error code', () => {
      const error = createJsonRpcError(-32600, 'Invalid Request');
      const formatted = formatError(error);

      expect(formatted).toContain('-32600');
    });

    test('shows error message', () => {
      const error = createJsonRpcError(-32601, 'Method not found');
      const formatted = formatError(error);

      expect(formatted).toContain('Method not found');
    });
  });

  describe('VersionMismatchError', () => {
    test('shows detected version', () => {
      const error = createVersionMismatchError('1.14.0', '1.16.0');
      const formatted = formatError(error);

      expect(formatted).toContain('1.14.0');
    });

    test('shows minimum version', () => {
      const error = createVersionMismatchError('1.14.0', '1.16.0');
      const formatted = formatError(error);

      expect(formatted).toContain('1.16.0');
    });

    test('includes update URL', () => {
      const error = createVersionMismatchError('1.14.0', '1.16.0');
      const formatted = formatError(error);

      expect(formatted).toContain('https://');
      expect(formatted).toContain('updating-goose');
    });
  });
});
