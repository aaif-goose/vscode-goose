import { describe, expect, test } from 'bun:test';
import { createMockStreams } from './streams';
import { createMockMemento } from './vscode';

describe('createMockMemento', () => {
  test('returns undefined for missing key', () => {
    const memento = createMockMemento();
    expect(memento.get('missing')).toBeUndefined();
  });

  test('returns default value for missing key', () => {
    const memento = createMockMemento();
    expect(memento.get('missing', 'default')).toBe('default');
  });

  test('stores and retrieves value', async () => {
    const memento = createMockMemento();
    await memento.update('key', { value: 'test' });
    expect(memento.get('key')).toEqual({ value: 'test' });
  });

  test('deletes key when value is undefined', async () => {
    const memento = createMockMemento();
    await memento.update('key', 'value');
    expect(memento.get('key')).toBe('value');

    await memento.update('key', undefined);
    expect(memento.get('key')).toBeUndefined();
  });

  test('returns stored keys', async () => {
    const memento = createMockMemento();
    await memento.update('a', 1);
    await memento.update('b', 2);
    expect(memento.keys()).toEqual(['a', 'b']);
  });
});

describe('createMockStreams', () => {
  test('captures written data', () => {
    const { stdin, written } = createMockStreams();
    stdin.write('test data');
    expect(written).toContain('test data');
  });

  test('pushResponse adds data to stdout', done => {
    const { stdout, pushResponse } = createMockStreams();

    stdout.on('data', (chunk: Buffer) => {
      expect(chunk.toString()).toBe('response\n');
      done();
    });

    pushResponse('response');
  });

  test('close ends the stdout stream', done => {
    const { stdout, close } = createMockStreams();

    stdout.on('end', () => {
      done();
    });

    // Need to consume data for 'end' to fire
    // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional noop for stream consumption
    stdout.on('data', () => {});
    close();
  });
});
