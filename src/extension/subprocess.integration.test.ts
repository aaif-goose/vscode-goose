/**
 * Integration tests for subprocess communication via JSON-RPC.
 * Uses a MockSubprocess simulator to test end-to-end message flows
 * without spawning a real subprocess.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import * as E from 'fp-ts/Either';
import { Readable, Writable } from 'stream';
import { isJsonRpcError } from '../shared/errors';
import { JsonRpcNotification, JsonRpcRequest, JsonRpcResponse } from '../shared/types';
import { createJsonRpcClient, JsonRpcClient, JsonRpcClientConfig } from './jsonRpcClient';
import { Logger } from './logger';

// ============================================================================
// Mock Subprocess Simulator
// ============================================================================

/** Handler function type for mock subprocess methods */
type MethodHandler = (params: unknown) => unknown;

/** Interface for the bidirectional mock streams */
interface BidirectionalMockStreams {
  /** Stream where client writes requests (subprocess reads) */
  readonly clientToSubprocess: Writable;
  /** Stream where subprocess writes responses (client reads) */
  readonly subprocessToClient: Readable;
  /** Close the subprocess output stream */
  close: () => void;
}

/**
 * Creates bidirectional mock streams for subprocess simulation.
 * The client writes to clientToSubprocess, and the subprocess
 * reads those writes via onRequest callback and writes responses
 * to subprocessToClient.
 */
function createBidirectionalMockStreams(
  onRequest: (data: string) => void
): BidirectionalMockStreams {
  // Client writes here, we intercept and call onRequest
  const clientToSubprocess = new Writable({
    write(chunk, _encoding, callback) {
      onRequest(chunk.toString());
      callback();
    },
  });

  // Subprocess writes here, client reads from here
  const subprocessToClient = new Readable({
    read() {
      // No-op: data is pushed via push()
    },
  });

  return {
    clientToSubprocess,
    subprocessToClient,
    close: () => {
      subprocessToClient.push(null);
    },
  };
}

/**
 * MockSubprocess simulates a subprocess that responds to JSON-RPC requests.
 * It processes requests via registered handlers and writes responses back.
 */
class MockSubprocess {
  private handlers: Map<string, MethodHandler> = new Map();
  private streams: BidirectionalMockStreams | null = null;
  private shouldCrash: boolean = false;
  private crashAfterRequests: number = -1;
  private requestCount: number = 0;
  private buffer: string = '';

  /**
   * Register a handler for a specific JSON-RPC method
   */
  registerHandler(method: string, handler: MethodHandler): void {
    this.handlers.set(method, handler);
  }

  /**
   * Process an incoming JSON-RPC request and return appropriate response
   */
  handleRequest(request: JsonRpcRequest): JsonRpcResponse {
    const handler = this.handlers.get(request.method);
    if (handler) {
      try {
        const result = handler(request.params);
        return {
          jsonrpc: '2.0',
          id: request.id,
          result,
        };
      } catch (err) {
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32000,
            message: err instanceof Error ? err.message : String(err),
          },
        };
      }
    }
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: { code: -32601, message: 'Method not found' },
    };
  }

  /**
   * Create streams and start processing
   * Returns the streams for the client to use
   */
  createStreams(): BidirectionalMockStreams {
    this.streams = createBidirectionalMockStreams((data: string) => {
      this.processIncomingData(data);
    });
    return this.streams;
  }

  /**
   * Process incoming data from client
   */
  private processIncomingData(data: string): void {
    if (this.shouldCrash || !this.streams) {
      return;
    }

    this.buffer += data;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      this.requestCount++;

      // Check if we should crash after this request
      if (this.crashAfterRequests > 0 && this.requestCount >= this.crashAfterRequests) {
        this.shouldCrash = true;
        this.streams.close();
        return;
      }

      try {
        const request = JSON.parse(trimmed) as JsonRpcRequest;

        // Only respond to requests (have id), not notifications
        if ('id' in request && request.id !== undefined) {
          const response = this.handleRequest(request);
          this.pushResponse(JSON.stringify(response));
        }
      } catch {
        // Malformed JSON - in a real subprocess this might crash or log error
        // We simulate graceful handling by not responding
      }
    }
  }

  /**
   * Push a response to the client
   */
  private pushResponse(data: string): void {
    if (this.streams && !this.shouldCrash) {
      this.streams.subprocessToClient.push(data + '\n');
    }
  }

  /**
   * Send a notification from the subprocess to the client
   */
  sendNotification(method: string, params?: unknown): void {
    if (this.shouldCrash || !this.streams) return;

    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      ...(params !== undefined && { params }),
    };
    this.pushResponse(JSON.stringify(notification));
  }

  /**
   * Configure the subprocess to crash after N requests
   */
  crashAfter(requests: number): void {
    this.crashAfterRequests = requests;
  }

  /**
   * Simulate an immediate crash
   */
  crash(): void {
    this.shouldCrash = true;
    if (this.streams) {
      this.streams.close();
    }
  }

  /**
   * Send malformed JSON to test error handling
   */
  sendMalformedResponse(data: string): void {
    if (this.streams && !this.shouldCrash) {
      this.streams.subprocessToClient.push(data + '\n');
    }
  }

  /**
   * Push empty line
   */
  pushEmptyLine(): void {
    if (this.streams && !this.shouldCrash) {
      this.streams.subprocessToClient.push('\n');
    }
  }
}

// ============================================================================
// Test Utilities
// ============================================================================

/** Create a no-op logger for testing */
function createMockLogger(): Logger {
  const noop = () => undefined;
  return {
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
  };
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('Subprocess Integration Tests', () => {
  let client: JsonRpcClient;
  let subprocess: MockSubprocess;
  let streams: BidirectionalMockStreams;

  beforeEach(() => {
    subprocess = new MockSubprocess();
    streams = subprocess.createStreams();

    const config: JsonRpcClientConfig = {
      stdin: streams.clientToSubprocess,
      stdout: streams.subprocessToClient,
      logger: createMockLogger(),
      timeoutMs: 1000,
    };
    client = createJsonRpcClient(config);
  });

  afterEach(() => {
    client.dispose();
  });

  describe('Request/Response Round-Trip', () => {
    test('completes successfully with simple handler', async () => {
      subprocess.registerHandler('echo', params => ({ echoed: params }));

      const result = await client.request<{ echoed: unknown }>('echo', { message: 'hello' })();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right).toEqual({ echoed: { message: 'hello' } });
      }
    });

    test('completes successfully with handler returning primitive', async () => {
      subprocess.registerHandler('add', params => {
        const p = params as { a: number; b: number };
        return p.a + p.b;
      });

      const result = await client.request<number>('add', { a: 5, b: 3 })();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right).toBe(8);
      }
    });

    test('returns error for unregistered method', async () => {
      const result = await client.request('unknown.method')();

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(isJsonRpcError(result.left)).toBe(true);
        expect(result.left.code).toBe(-32601);
        expect(result.left.message).toBe('Method not found');
      }
    });

    test('returns error when handler throws', async () => {
      subprocess.registerHandler('failing', () => {
        throw new Error('Handler error');
      });

      const result = await client.request('failing')();

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(isJsonRpcError(result.left)).toBe(true);
        expect(result.left.message).toBe('Handler error');
      }
    });

    test('handles null result correctly', async () => {
      subprocess.registerHandler('getNull', () => null);

      const result = await client.request<null>('getNull')();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right).toBeNull();
      }
    });

    test('handles complex nested response correctly', async () => {
      const complexData = {
        users: [
          { id: 1, name: 'Alice', metadata: { role: 'admin' } },
          { id: 2, name: 'Bob', metadata: { role: 'user' } },
        ],
        pagination: { page: 1, total: 100 },
      };
      subprocess.registerHandler('getComplex', () => complexData);

      const result = await client.request<typeof complexData>('getComplex')();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right).toEqual(complexData);
      }
    });
  });

  describe('Concurrent Requests', () => {
    test('resolves multiple concurrent requests correctly', async () => {
      subprocess.registerHandler('identify', params => {
        const p = params as { id: string };
        return { response: `Response for ${p.id}` };
      });

      const [result1, result2, result3] = await Promise.all([
        client.request<{ response: string }>('identify', { id: 'A' })(),
        client.request<{ response: string }>('identify', { id: 'B' })(),
        client.request<{ response: string }>('identify', { id: 'C' })(),
      ]);

      expect(E.isRight(result1)).toBe(true);
      expect(E.isRight(result2)).toBe(true);
      expect(E.isRight(result3)).toBe(true);

      if (E.isRight(result1)) {
        expect(result1.right.response).toBe('Response for A');
      }
      if (E.isRight(result2)) {
        expect(result2.right.response).toBe('Response for B');
      }
      if (E.isRight(result3)) {
        expect(result3.right.response).toBe('Response for C');
      }
    });

    test('handles mixed success and failure in concurrent requests', async () => {
      subprocess.registerHandler('mayFail', params => {
        const p = params as { shouldFail: boolean };
        if (p.shouldFail) {
          throw new Error('Intentional failure');
        }
        return { success: true };
      });

      const [success1, failure, success2] = await Promise.all([
        client.request('mayFail', { shouldFail: false })(),
        client.request('mayFail', { shouldFail: true })(),
        client.request('mayFail', { shouldFail: false })(),
      ]);

      expect(E.isRight(success1)).toBe(true);
      expect(E.isLeft(failure)).toBe(true);
      expect(E.isRight(success2)).toBe(true);
    });

    test('maintains request/response correlation under load', async () => {
      subprocess.registerHandler('delay', params => {
        const p = params as { value: number };
        return { doubled: p.value * 2 };
      });

      // Fire 10 concurrent requests with different values
      const requests = Array.from({ length: 10 }, (_, i) =>
        client.request<{ doubled: number }>('delay', { value: i })()
      );

      const results = await Promise.all(requests);

      // Verify all completed and returned correct values
      results.forEach((result, i) => {
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.doubled).toBe(i * 2);
        }
      });
    });
  });

  describe('Notification Handling', () => {
    test('receives notifications from subprocess', async () => {
      const receivedNotifications: JsonRpcNotification[] = [];
      client.onNotification(notification => {
        receivedNotifications.push(notification);
      });

      subprocess.sendNotification('server.event', { type: 'update', data: 'new data' });

      // Wait for notification to be processed
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(receivedNotifications.length).toBe(1);
      expect(receivedNotifications[0].method).toBe('server.event');
      expect(receivedNotifications[0].params).toEqual({ type: 'update', data: 'new data' });
    });

    test('receives multiple notifications in order', async () => {
      const receivedNotifications: JsonRpcNotification[] = [];
      client.onNotification(notification => {
        receivedNotifications.push(notification);
      });

      subprocess.sendNotification('event', { seq: 1 });
      subprocess.sendNotification('event', { seq: 2 });
      subprocess.sendNotification('event', { seq: 3 });

      await new Promise(resolve => setTimeout(resolve, 20));

      expect(receivedNotifications.length).toBe(3);
      expect((receivedNotifications[0].params as { seq: number }).seq).toBe(1);
      expect((receivedNotifications[1].params as { seq: number }).seq).toBe(2);
      expect((receivedNotifications[2].params as { seq: number }).seq).toBe(3);
    });

    test('notifications do not interfere with pending requests', async () => {
      subprocess.registerHandler('slow', () => 'done');

      const receivedNotifications: JsonRpcNotification[] = [];
      client.onNotification(notification => {
        receivedNotifications.push(notification);
      });

      // Start a request
      const requestPromise = client.request<string>('slow')();

      // Send notifications while request is pending
      subprocess.sendNotification('interrupt', { msg: 'notification 1' });
      subprocess.sendNotification('interrupt', { msg: 'notification 2' });

      const result = await requestPromise;
      await new Promise(resolve => setTimeout(resolve, 20));

      // Request should complete successfully
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right).toBe('done');
      }

      // Notifications should also be received
      expect(receivedNotifications.length).toBe(2);
    });

    test('handles notifications without params', async () => {
      const receivedNotifications: JsonRpcNotification[] = [];
      client.onNotification(notification => {
        receivedNotifications.push(notification);
      });

      subprocess.sendNotification('ping');

      await new Promise(resolve => setTimeout(resolve, 20));

      expect(receivedNotifications.length).toBe(1);
      expect(receivedNotifications[0].method).toBe('ping');
      expect(receivedNotifications[0].params).toBeUndefined();
    });
  });

  describe('Subprocess Crash Handling', () => {
    test('pending requests fail when subprocess crashes', async () => {
      // Don't register any handler - request will not get a response
      // And we crash the subprocess immediately

      // Start request
      const requestPromise = client.request('neverCompletes')();

      // Wait a tick then crash
      await new Promise(resolve => setTimeout(resolve, 10));
      subprocess.crash();

      const result = await requestPromise;

      // The client should timeout or receive an error when stream closes
      // With a 1 second timeout, we'll get a timeout error
      expect(E.isLeft(result)).toBe(true);
    });

    test('crash after N requests stops further responses', async () => {
      let handlerCallCount = 0;
      subprocess.registerHandler('countAndReturn', () => {
        handlerCallCount++;
        return { count: handlerCallCount };
      });

      subprocess.crashAfter(2);

      // First request should succeed
      const result1 = await client.request('countAndReturn')();
      expect(E.isRight(result1)).toBe(true);

      // Second request triggers crash - it may or may not complete
      // depending on timing
      const result2Promise = client.request('countAndReturn')();

      // After crash, subsequent requests should timeout
      await result2Promise;
      // Result could be success (if crash happens after response) or timeout
      // Just verify it doesn't hang
    });

    test('notifications stop after crash', async () => {
      const receivedNotifications: JsonRpcNotification[] = [];
      client.onNotification(notification => {
        receivedNotifications.push(notification);
      });

      // Send notification before crash
      subprocess.sendNotification('before', { when: 'before' });
      await new Promise(resolve => setTimeout(resolve, 20));

      // Crash
      subprocess.crash();

      // Try to send notification after crash (should be ignored)
      subprocess.sendNotification('after', { when: 'after' });
      await new Promise(resolve => setTimeout(resolve, 20));

      // Only notification before crash should be received
      expect(receivedNotifications.length).toBe(1);
      expect(receivedNotifications[0].method).toBe('before');
    });
  });

  describe('Malformed JSON Handling', () => {
    test('handles malformed JSON gracefully without crashing', async () => {
      const receivedNotifications: JsonRpcNotification[] = [];
      client.onNotification(notification => {
        receivedNotifications.push(notification);
      });

      // Send malformed JSON
      subprocess.sendMalformedResponse('{ invalid json }');

      // Wait a tick
      await new Promise(resolve => setTimeout(resolve, 20));

      // Client should not crash
      // Send valid notification to verify client still works
      subprocess.sendNotification('afterMalformed', { status: 'ok' });

      await new Promise(resolve => setTimeout(resolve, 20));

      // Should receive the valid notification
      expect(receivedNotifications.length).toBe(1);
      expect(receivedNotifications[0].method).toBe('afterMalformed');
    });

    test('continues processing valid messages after malformed JSON', async () => {
      subprocess.registerHandler('test', () => 'success');

      // Send malformed JSON directly
      subprocess.sendMalformedResponse('not json at all');

      // Then make a valid request
      const result = await client.request<string>('test')();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right).toBe('success');
      }
    });

    test('handles truncated JSON gracefully', async () => {
      const receivedNotifications: JsonRpcNotification[] = [];
      client.onNotification(notification => {
        receivedNotifications.push(notification);
      });

      // Send truncated JSON
      subprocess.sendMalformedResponse('{"jsonrpc":"2.0","method":"truncated"');

      // Send valid notification
      subprocess.sendNotification('valid', { data: 'ok' });

      await new Promise(resolve => setTimeout(resolve, 20));

      // Only the valid notification should be processed
      expect(receivedNotifications.length).toBe(1);
      expect(receivedNotifications[0].method).toBe('valid');
    });

    test('handles empty response lines gracefully', async () => {
      subprocess.registerHandler('test', () => 'works');

      // Send empty lines
      subprocess.pushEmptyLine();
      subprocess.pushEmptyLine();

      // Valid request should still work
      const result = await client.request<string>('test')();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right).toBe('works');
      }
    });

    test('handles response with wrong JSON-RPC version gracefully', async () => {
      const receivedNotifications: JsonRpcNotification[] = [];
      client.onNotification(notification => {
        receivedNotifications.push(notification);
      });

      // Send response with wrong version (still valid JSON)
      subprocess.sendMalformedResponse('{"jsonrpc":"1.0","method":"wrongVersion"}');

      // The client may or may not process this depending on implementation
      // But it should not crash
      subprocess.sendNotification('afterWrongVersion', {});

      await new Promise(resolve => setTimeout(resolve, 20));

      // At minimum, subsequent valid messages should work
      expect(receivedNotifications.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('End-to-End Scenarios', () => {
    test('simulates initialize -> session/new -> session/prompt flow', async () => {
      // Register handlers simulating real ACP protocol
      subprocess.registerHandler('initialize', () => ({
        protocolVersion: '1.0',
        serverInfo: { name: 'goose-acp', version: '1.16.0' },
      }));

      subprocess.registerHandler('session/new', () => ({
        sessionId: 'test-session-123',
      }));

      subprocess.registerHandler('session/prompt', params => {
        const p = params as { prompt: string };
        return {
          response: `Echo: ${p.prompt}`,
        };
      });

      // Simulate ACP initialization flow
      const initResult = await client.request<{
        protocolVersion: string;
        serverInfo: { name: string; version: string };
      }>('initialize')();

      expect(E.isRight(initResult)).toBe(true);
      if (E.isRight(initResult)) {
        expect(initResult.right.protocolVersion).toBe('1.0');
        expect(initResult.right.serverInfo.name).toBe('goose-acp');
      }

      const sessionResult = await client.request<{ sessionId: string }>('session/new')();
      expect(E.isRight(sessionResult)).toBe(true);
      if (E.isRight(sessionResult)) {
        expect(sessionResult.right.sessionId).toBe('test-session-123');
      }

      const promptResult = await client.request<{ response: string }>('session/prompt', {
        prompt: 'Hello, Goose!',
      })();
      expect(E.isRight(promptResult)).toBe(true);
      if (E.isRight(promptResult)) {
        expect(promptResult.right.response).toBe('Echo: Hello, Goose!');
      }
    });

    test('handles streaming updates via notifications', async () => {
      subprocess.registerHandler('session/prompt', () => {
        // Simulate sending streaming updates as notifications
        setTimeout(() => subprocess.sendNotification('session/update', { chunk: 'Hello' }), 5);
        setTimeout(() => subprocess.sendNotification('session/update', { chunk: ' World' }), 10);
        setTimeout(() => subprocess.sendNotification('session/update', { done: true }), 15);
        return { started: true };
      });

      const updates: unknown[] = [];
      client.onNotification(notification => {
        if (notification.method === 'session/update') {
          updates.push(notification.params);
        }
      });

      const result = await client.request('session/prompt', { prompt: 'test' })();
      expect(E.isRight(result)).toBe(true);

      // Wait for notifications
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(updates.length).toBe(3);
      expect(updates[0]).toEqual({ chunk: 'Hello' });
      expect(updates[1]).toEqual({ chunk: ' World' });
      expect(updates[2]).toEqual({ done: true });
    });
  });
});
