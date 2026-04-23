import { beforeEach, describe, expect, test } from 'bun:test';
import * as E from 'fp-ts/Either';
import { isJsonRpcError, isJsonRpcTimeoutError } from '../shared/errors';
import { createMockStreams, MockStreams } from '../test/mocks/streams';
import { createJsonRpcClient, JsonRpcClient, JsonRpcClientConfig } from './jsonRpcClient';
import { Logger } from './logger';

/**
 * Tests for JSON-RPC 2.0 client implementation.
 * Uses mock streams to simulate subprocess communication.
 */

// Create a no-op logger for testing
function createMockLogger(): Logger {
  const noop = () => undefined;
  return {
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
  };
}

describe('createJsonRpcClient', () => {
  let mockStreams: MockStreams;
  let client: JsonRpcClient;
  let logger: Logger;

  beforeEach(() => {
    mockStreams = createMockStreams();
    logger = createMockLogger();
    const config: JsonRpcClientConfig = {
      stdin: mockStreams.stdin,
      stdout: mockStreams.stdout,
      logger,
      timeoutMs: 1000, // Short timeout for tests
    };
    client = createJsonRpcClient(config);
  });

  describe('request()', () => {
    test('encodes valid JSON-RPC 2.0 format', async () => {
      const requestTask = client.request('test.method', { key: 'value' });

      // Start the request
      const requestPromise = requestTask();

      // Wait a tick for the write to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      // Check what was written
      expect(mockStreams.written.length).toBe(1);
      const sentMessage = JSON.parse(mockStreams.written[0].trim());
      expect(sentMessage.jsonrpc).toBe('2.0');
      expect(sentMessage.method).toBe('test.method');
      expect(sentMessage.params).toEqual({ key: 'value' });
      expect(typeof sentMessage.id).toBe('number');
      expect(sentMessage.id).toBe(1);

      // Send response to complete the request
      mockStreams.pushResponse(JSON.stringify({ jsonrpc: '2.0', id: 1, result: 'ok' }));
      await requestPromise;
    });

    test('auto-increments request ID', async () => {
      // Make two requests
      const request1 = client.request('method1');
      const request2 = client.request('method2');

      // Start both requests
      const promise1 = request1();
      const promise2 = request2();

      // Wait for writes
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockStreams.written.length).toBe(2);
      const msg1 = JSON.parse(mockStreams.written[0].trim());
      const msg2 = JSON.parse(mockStreams.written[1].trim());

      expect(msg1.id).toBe(1);
      expect(msg2.id).toBe(2);

      // Resolve requests
      mockStreams.pushResponse(JSON.stringify({ jsonrpc: '2.0', id: 1, result: 'result1' }));
      mockStreams.pushResponse(JSON.stringify({ jsonrpc: '2.0', id: 2, result: 'result2' }));

      await promise1;
      await promise2;
    });

    test('omits params when undefined', async () => {
      const requestTask = client.request('no.params');
      const requestPromise = requestTask();

      await new Promise(resolve => setTimeout(resolve, 0));

      const sentMessage = JSON.parse(mockStreams.written[0].trim());
      expect(sentMessage.params).toBeUndefined();
      expect('params' in sentMessage).toBe(false);

      mockStreams.pushResponse(JSON.stringify({ jsonrpc: '2.0', id: 1, result: null }));
      await requestPromise;
    });

    test('resolves with result on success response', async () => {
      const requestTask = client.request<{ data: string }>('get.data');
      const requestPromise = requestTask();

      // Wait for write
      await new Promise(resolve => setTimeout(resolve, 0));

      // Send success response
      const expectedResult = { data: 'hello world' };
      mockStreams.pushResponse(JSON.stringify({ jsonrpc: '2.0', id: 1, result: expectedResult }));

      const result = await requestPromise;

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right).toEqual(expectedResult);
      }
    });

    test('rejects with JsonRpcError on error response', async () => {
      const requestTask = client.request('failing.method');
      const requestPromise = requestTask();

      await new Promise(resolve => setTimeout(resolve, 0));

      // Send error response
      mockStreams.pushResponse(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -32601,
            message: 'Method not found',
            data: { details: 'unknown method' },
          },
        })
      );

      const result = await requestPromise;

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(isJsonRpcError(result.left)).toBe(true);
        expect(result.left._tag).toBe('JsonRpcError');
        expect(result.left.code).toBe(-32601);
        expect(result.left.message).toBe('Method not found');
        expect(result.left.data).toEqual({ details: 'unknown method' });
      }
    });

    test('rejects with JsonRpcTimeoutError on timeout', async () => {
      // Create client with very short timeout
      const shortTimeoutConfig: JsonRpcClientConfig = {
        stdin: mockStreams.stdin,
        stdout: mockStreams.stdout,
        logger,
        timeoutMs: 50, // 50ms timeout
      };
      const shortTimeoutClient = createJsonRpcClient(shortTimeoutConfig);

      const requestTask = shortTimeoutClient.request('slow.method');
      const result = await requestTask();

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(isJsonRpcTimeoutError(result.left)).toBe(true);
        expect(result.left._tag).toBe('JsonRpcTimeoutError');
        expect(result.left.method).toBe('slow.method');
        expect(result.left.timeoutMs).toBe(50);
        expect(result.left.requestId).toBe(1);
      }
    });

    test('request with timeoutMs: undefined inherits the client default', async () => {
      // Default client timeout for this describe() is 1000ms. Explicit
      // `undefined` must behave exactly like an omitted option and time out.
      const shortTimeoutConfig: JsonRpcClientConfig = {
        stdin: mockStreams.stdin,
        stdout: mockStreams.stdout,
        logger,
        timeoutMs: 50,
      };
      const c = createJsonRpcClient(shortTimeoutConfig);
      const result = await c.request('slow.method', undefined, { timeoutMs: undefined })();

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left._tag).toBe('JsonRpcTimeoutError');
      }
    });

    test('request with timeoutMs: null never times out', async () => {
      // Default client timeout for this describe() is 1000ms. A response pushed
      // after 1500ms would normally fire the timeout timer; with `timeoutMs: null`
      // the timer must not be scheduled at all.
      const requestTask = client.request<string>('long.stream', undefined, { timeoutMs: null });
      const requestPromise = requestTask();

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mockStreams.written.length).toBe(1);

      // Wait past the default timeout before responding.
      await new Promise(resolve => setTimeout(resolve, 1500));

      mockStreams.pushResponse(JSON.stringify({ jsonrpc: '2.0', id: 1, result: 'late-but-valid' }));

      const result = await requestPromise;

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right).toBe('late-but-valid');
      }
    });

    test('matches responses to correct pending requests', async () => {
      const request1 = client.request<string>('method1');
      const request2 = client.request<string>('method2');

      const promise1 = request1();
      const promise2 = request2();

      await new Promise(resolve => setTimeout(resolve, 0));

      // Send responses out of order
      mockStreams.pushResponse(JSON.stringify({ jsonrpc: '2.0', id: 2, result: 'result2' }));
      mockStreams.pushResponse(JSON.stringify({ jsonrpc: '2.0', id: 1, result: 'result1' }));

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(E.isRight(result1) && result1.right).toBe('result1');
      expect(E.isRight(result2) && result2.right).toBe('result2');
    });
  });

  describe('notify()', () => {
    test('encodes notification without ID field', () => {
      const result = client.notify('notification.method', { key: 'value' });

      expect(E.isRight(result)).toBe(true);
      expect(mockStreams.written.length).toBe(1);

      const sentMessage = JSON.parse(mockStreams.written[0].trim());
      expect(sentMessage.jsonrpc).toBe('2.0');
      expect(sentMessage.method).toBe('notification.method');
      expect(sentMessage.params).toEqual({ key: 'value' });
      expect('id' in sentMessage).toBe(false);
    });

    test('omits params when undefined', () => {
      client.notify('simple.notification');

      const sentMessage = JSON.parse(mockStreams.written[0].trim());
      expect('params' in sentMessage).toBe(false);
    });

    test('returns Right on success', () => {
      const result = client.notify('test.notification');

      expect(E.isRight(result)).toBe(true);
    });

    test('returns Left when client is disposed', () => {
      client.dispose();

      const result = client.notify('after.dispose');

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left._tag).toBe('JsonRpcParseError');
        expect(result.left.parseError).toBe('Client disposed');
      }
    });
  });

  describe('onNotification()', () => {
    test('invokes callback for incoming notifications', async () => {
      const receivedNotifications: unknown[] = [];

      client.onNotification(notification => {
        receivedNotifications.push(notification);
      });

      // Push a notification (no ID field)
      mockStreams.pushResponse(
        JSON.stringify({
          jsonrpc: '2.0',
          method: 'server.event',
          params: { event: 'something_happened' },
        })
      );

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(receivedNotifications.length).toBe(1);
      expect(receivedNotifications[0]).toEqual({
        jsonrpc: '2.0',
        method: 'server.event',
        params: { event: 'something_happened' },
      });
    });

    test('invokes multiple callbacks for same notification', async () => {
      let callback1Called = false;
      let callback2Called = false;

      client.onNotification(() => {
        callback1Called = true;
      });
      client.onNotification(() => {
        callback2Called = true;
      });

      mockStreams.pushResponse(
        JSON.stringify({
          jsonrpc: '2.0',
          method: 'broadcast',
        })
      );

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(callback1Called).toBe(true);
      expect(callback2Called).toBe(true);
    });

    test('does not invoke callback for response messages', async () => {
      const receivedNotifications: unknown[] = [];

      client.onNotification(notification => {
        receivedNotifications.push(notification);
      });

      // Start a request
      const requestPromise = client.request('test')();
      await new Promise(resolve => setTimeout(resolve, 0));

      // Push a response (has ID field)
      mockStreams.pushResponse(JSON.stringify({ jsonrpc: '2.0', id: 1, result: 'ok' }));

      await requestPromise;
      await new Promise(resolve => setTimeout(resolve, 10));

      // Notification callback should not be invoked for responses
      expect(receivedNotifications.length).toBe(0);
    });

    test('handles notification without params', async () => {
      const receivedNotifications: unknown[] = [];

      client.onNotification(notification => {
        receivedNotifications.push(notification);
      });

      mockStreams.pushResponse(
        JSON.stringify({
          jsonrpc: '2.0',
          method: 'ping',
        })
      );

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(receivedNotifications.length).toBe(1);
      expect(receivedNotifications[0]).toEqual({
        jsonrpc: '2.0',
        method: 'ping',
      });
    });

    test('callback errors are caught and do not prevent other callbacks', async () => {
      let callback2Called = false;

      client.onNotification(() => {
        throw new Error('Callback error');
      });
      client.onNotification(() => {
        callback2Called = true;
      });

      mockStreams.pushResponse(JSON.stringify({ jsonrpc: '2.0', method: 'event' }));

      await new Promise(resolve => setTimeout(resolve, 10));

      // Second callback should still be called despite first throwing
      expect(callback2Called).toBe(true);
    });
  });

  describe('dispose()', () => {
    test('rejects pending requests with JsonRpcError', async () => {
      // Start a request that won't be answered
      const requestPromise = client.request('pending.method')();

      await new Promise(resolve => setTimeout(resolve, 0));

      // Dispose the client
      client.dispose();

      const result = await requestPromise;

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(isJsonRpcError(result.left)).toBe(true);
        expect(result.left.message).toBe('Client disposed');
      }
    });

    test('rejects all pending requests when multiple are outstanding', async () => {
      const promise1 = client.request('method1')();
      const promise2 = client.request('method2')();
      const promise3 = client.request('method3')();

      await new Promise(resolve => setTimeout(resolve, 0));

      client.dispose();

      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

      expect(E.isLeft(result1)).toBe(true);
      expect(E.isLeft(result2)).toBe(true);
      expect(E.isLeft(result3)).toBe(true);
    });

    test('prevents new requests after disposal', async () => {
      client.dispose();

      const result = await client.request('after.dispose')();

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(isJsonRpcError(result.left)).toBe(true);
        expect(result.left.message).toBe('Client disposed');
      }
    });

    test('prevents new notifications after disposal', () => {
      client.dispose();

      const result = client.notify('after.dispose');

      expect(E.isLeft(result)).toBe(true);
    });

    test('stops receiving notifications after disposal', async () => {
      const receivedNotifications: unknown[] = [];

      client.onNotification(notification => {
        receivedNotifications.push(notification);
      });

      client.dispose();

      // Push notification after disposal
      mockStreams.pushResponse(JSON.stringify({ jsonrpc: '2.0', method: 'late.event' }));

      await new Promise(resolve => setTimeout(resolve, 10));

      // No notifications should be received after disposal
      expect(receivedNotifications.length).toBe(0);
    });

    test('is idempotent (can be called multiple times)', async () => {
      const requestPromise = client.request('test')();
      await new Promise(resolve => setTimeout(resolve, 0));

      // Call dispose multiple times
      client.dispose();
      client.dispose();
      client.dispose();

      // Should not throw, request should still be rejected once
      const result = await requestPromise;
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('line buffering', () => {
    test('handles partial lines', async () => {
      const receivedNotifications: unknown[] = [];

      client.onNotification(notification => {
        receivedNotifications.push(notification);
      });

      // Send partial line, then complete it
      mockStreams.stdout.push('{"jsonrpc":"2.0",');
      mockStreams.stdout.push('"method":"partial"}\n');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(receivedNotifications.length).toBe(1);
      expect(receivedNotifications[0]).toEqual({ jsonrpc: '2.0', method: 'partial' });
    });

    test('handles multiple lines in single chunk', async () => {
      const receivedNotifications: unknown[] = [];

      client.onNotification(notification => {
        receivedNotifications.push(notification);
      });

      // Send multiple lines at once
      const multiLine = '{"jsonrpc":"2.0","method":"first"}\n{"jsonrpc":"2.0","method":"second"}\n';
      mockStreams.stdout.push(multiLine);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(receivedNotifications.length).toBe(2);
    });

    test('ignores empty lines', async () => {
      const receivedNotifications: unknown[] = [];

      client.onNotification(notification => {
        receivedNotifications.push(notification);
      });

      mockStreams.stdout.push('\n\n{"jsonrpc":"2.0","method":"test"}\n\n');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(receivedNotifications.length).toBe(1);
    });
  });

  describe('error handling', () => {
    test('handles malformed JSON gracefully', async () => {
      const receivedNotifications: unknown[] = [];

      client.onNotification(notification => {
        receivedNotifications.push(notification);
      });

      // Send invalid JSON
      mockStreams.pushResponse('not valid json');

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should not crash, just log error and continue
      expect(receivedNotifications.length).toBe(0);
    });

    test('continues processing after malformed JSON', async () => {
      const receivedNotifications: unknown[] = [];

      client.onNotification(notification => {
        receivedNotifications.push(notification);
      });

      // Send bad JSON followed by good JSON
      mockStreams.pushResponse('bad json');
      mockStreams.pushResponse(JSON.stringify({ jsonrpc: '2.0', method: 'valid' }));

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should process the valid message
      expect(receivedNotifications.length).toBe(1);
      expect((receivedNotifications[0] as { method: string }).method).toBe('valid');
    });

    test('logs warning for response with unknown ID', async () => {
      // This test verifies the client handles unknown IDs gracefully
      // by not throwing and continuing operation

      const receivedNotifications: unknown[] = [];
      client.onNotification(notification => {
        receivedNotifications.push(notification);
      });

      // Push response for non-existent request
      mockStreams.pushResponse(JSON.stringify({ jsonrpc: '2.0', id: 999, result: 'orphan' }));

      // Push a valid notification after
      mockStreams.pushResponse(JSON.stringify({ jsonrpc: '2.0', method: 'after.orphan' }));

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should still process subsequent messages
      expect(receivedNotifications.length).toBe(1);
      expect((receivedNotifications[0] as { method: string }).method).toBe('after.orphan');
    });
  });
});
