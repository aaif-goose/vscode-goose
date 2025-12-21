import { beforeEach, describe, expect, test } from 'bun:test';
import { SessionEntry } from '../shared/sessionTypes';
import { createMockMemento, MockMemento } from '../test/mocks/vscode';
import { createSessionStorage, SessionStorage } from './sessionStorage';

describe('SessionStorage', () => {
  let memento: MockMemento;
  let storage: SessionStorage;

  const createSession = (id: string, title = 'Test Session'): SessionEntry => ({
    sessionId: id,
    title,
    cwd: '/test/path',
    createdAt: new Date().toISOString(),
  });

  beforeEach(() => {
    memento = createMockMemento();
    storage = createSessionStorage(memento);
  });

  describe('getSessions', () => {
    test('returns empty array when no sessions stored', () => {
      const sessions = storage.getSessions();
      expect(sessions).toEqual([]);
    });

    test('returns stored sessions in order', async () => {
      const session1 = createSession('session-1', 'First');
      const session2 = createSession('session-2', 'Second');

      await storage.addSession(session1);
      await storage.addSession(session2);

      const sessions = storage.getSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions[0].sessionId).toBe('session-2');
      expect(sessions[1].sessionId).toBe('session-1');
    });
  });

  describe('addSession', () => {
    test('adds new session to front of list', async () => {
      const session1 = createSession('session-1');
      const session2 = createSession('session-2');

      await storage.addSession(session1);
      await storage.addSession(session2);

      const sessions = storage.getSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions[0].sessionId).toBe('session-2');
    });

    test('updates existing session when sessionId matches', async () => {
      const session = createSession('session-1', 'Original Title');
      await storage.addSession(session);

      const updatedSession = { ...session, title: 'Updated Title' };
      await storage.addSession(updatedSession);

      const sessions = storage.getSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].title).toBe('Updated Title');
    });

    test('preserves position when updating existing session', async () => {
      const session1 = createSession('session-1', 'First');
      const session2 = createSession('session-2', 'Second');
      const session3 = createSession('session-3', 'Third');

      await storage.addSession(session1);
      await storage.addSession(session2);
      await storage.addSession(session3);

      const updatedSession2 = { ...session2, title: 'Updated Second' };
      await storage.addSession(updatedSession2);

      const sessions = storage.getSessions();
      expect(sessions).toHaveLength(3);
      expect(sessions[1].title).toBe('Updated Second');
    });
  });

  describe('getSession', () => {
    test('returns session by ID', async () => {
      const session = createSession('session-1', 'My Session');
      await storage.addSession(session);

      const result = storage.getSession('session-1');
      expect(result).toBeDefined();
      expect(result?.sessionId).toBe('session-1');
      expect(result?.title).toBe('My Session');
    });

    test('returns undefined for missing ID', async () => {
      const session = createSession('session-1');
      await storage.addSession(session);

      const result = storage.getSession('non-existent');
      expect(result).toBeUndefined();
    });

    test('returns undefined when no sessions exist', () => {
      const result = storage.getSession('any-id');
      expect(result).toBeUndefined();
    });
  });

  describe('updateSessionTitle', () => {
    test('updates title of existing session', async () => {
      const session = createSession('session-1', 'Original');
      await storage.addSession(session);

      await storage.updateSessionTitle('session-1', 'New Title');

      const result = storage.getSession('session-1');
      expect(result?.title).toBe('New Title');
    });

    test('no-op for missing session', async () => {
      const session = createSession('session-1', 'Original');
      await storage.addSession(session);

      await storage.updateSessionTitle('non-existent', 'New Title');

      const sessions = storage.getSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].title).toBe('Original');
    });

    test('preserves other session fields', async () => {
      const session = createSession('session-1', 'Original');
      await storage.addSession(session);

      await storage.updateSessionTitle('session-1', 'New Title');

      const result = storage.getSession('session-1');
      expect(result?.cwd).toBe('/test/path');
      expect(result?.createdAt).toBe(session.createdAt);
    });
  });

  describe('setActiveSession', () => {
    test('stores active session ID', async () => {
      await storage.setActiveSession('session-1');

      const activeId = storage.getActiveSessionId();
      expect(activeId).toBe('session-1');
    });

    test('overwrites previous active session', async () => {
      await storage.setActiveSession('session-1');
      await storage.setActiveSession('session-2');

      const activeId = storage.getActiveSessionId();
      expect(activeId).toBe('session-2');
    });
  });

  describe('getActiveSessionId', () => {
    test('returns null when no active session', () => {
      const activeId = storage.getActiveSessionId();
      expect(activeId).toBeNull();
    });

    test('returns active session ID when set', async () => {
      await storage.setActiveSession('session-1');

      const activeId = storage.getActiveSessionId();
      expect(activeId).toBe('session-1');
    });
  });

  describe('removeSession', () => {
    test('removes session from list', async () => {
      const session1 = createSession('session-1');
      const session2 = createSession('session-2');

      await storage.addSession(session1);
      await storage.addSession(session2);

      await storage.removeSession('session-1');

      const sessions = storage.getSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].sessionId).toBe('session-2');
    });

    test('clears active session when removed session was active', async () => {
      const session = createSession('session-1');
      await storage.addSession(session);
      await storage.setActiveSession('session-1');

      await storage.removeSession('session-1');

      const activeId = storage.getActiveSessionId();
      expect(activeId).toBeNull();
    });

    test('preserves active session when different session removed', async () => {
      const session1 = createSession('session-1');
      const session2 = createSession('session-2');

      await storage.addSession(session1);
      await storage.addSession(session2);
      await storage.setActiveSession('session-1');

      await storage.removeSession('session-2');

      const activeId = storage.getActiveSessionId();
      expect(activeId).toBe('session-1');
    });

    test('no-op when removing non-existent session', async () => {
      const session = createSession('session-1');
      await storage.addSession(session);

      await storage.removeSession('non-existent');

      const sessions = storage.getSessions();
      expect(sessions).toHaveLength(1);
    });
  });

  describe('clearAll', () => {
    test('removes all sessions', async () => {
      await storage.addSession(createSession('session-1'));
      await storage.addSession(createSession('session-2'));

      await storage.clearAll();

      const sessions = storage.getSessions();
      expect(sessions).toEqual([]);
    });

    test('clears active session', async () => {
      await storage.addSession(createSession('session-1'));
      await storage.setActiveSession('session-1');

      await storage.clearAll();

      const activeId = storage.getActiveSessionId();
      expect(activeId).toBeNull();
    });

    test('removes storage keys from memento', async () => {
      await storage.addSession(createSession('session-1'));
      await storage.setActiveSession('session-1');

      await storage.clearAll();

      expect(memento.keys()).toEqual([]);
    });
  });

  describe('schema migration', () => {
    test('returns empty array for mismatched schema version', async () => {
      await memento.update('goose.sessions.v1', {
        schemaVersion: 999,
        activeSessionId: null,
        sessions: [createSession('session-1')],
      });

      storage = createSessionStorage(memento);
      const sessions = storage.getSessions();
      expect(sessions).toEqual([]);
    });

    test('returns empty array when no schema version present', async () => {
      await memento.update('goose.sessions.v1', {
        sessions: [createSession('session-1')],
      });

      storage = createSessionStorage(memento);
      const sessions = storage.getSessions();
      expect(sessions).toEqual([]);
    });

    test('returns sessions for matching schema version', async () => {
      const session = createSession('session-1');
      await memento.update('goose.sessions.v1', {
        schemaVersion: 1,
        activeSessionId: null,
        sessions: [session],
      });

      storage = createSessionStorage(memento);
      const sessions = storage.getSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].sessionId).toBe('session-1');
    });
  });
});
