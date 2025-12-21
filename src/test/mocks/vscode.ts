/**
 * Mock utilities for VS Code API
 * Used by extension module tests that require VS Code globalState mocking
 */

/**
 * Creates a mock vscode.Memento implementation backed by an in-memory Map.
 * Supports get, update, and keys operations as defined by the VS Code API.
 *
 * @example
 * ```typescript
 * const memento = createMockMemento();
 * await memento.update('key', { value: 'test' });
 * const result = memento.get('key');
 * ```
 */
export function createMockMemento(): MockMemento {
  const store = new Map<string, unknown>();

  return {
    get: <T>(key: string, defaultValue?: T): T | undefined => (store.get(key) as T) ?? defaultValue,

    update: async (key: string, value: unknown): Promise<void> => {
      if (value === undefined) {
        store.delete(key);
      } else {
        store.set(key, value);
      }
    },

    keys: (): readonly string[] => [...store.keys()],

    // Expose internal store for test assertions
    _store: store,
  };
}

/**
 * Mock Memento interface matching vscode.Memento with test helpers
 */
export interface MockMemento {
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: unknown): Promise<void>;
  keys(): readonly string[];
  /** Internal store exposed for test assertions */
  readonly _store: Map<string, unknown>;
}
