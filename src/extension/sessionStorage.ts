/**
 * Session storage for persisting session metadata in VS Code globalState.
 * Stores minimal data: session ID, title, cwd, and createdAt.
 */

import * as vscode from 'vscode';
import { SessionEntry, SessionStorageData } from '../shared/sessionTypes';

const STORAGE_KEY_SESSIONS = 'goose.sessions.v1';
const STORAGE_KEY_ACTIVE = 'goose.activeSession';
const CURRENT_SCHEMA_VERSION = 1;

export interface SessionStorage {
  getSessions(): readonly SessionEntry[];
  getSession(sessionId: string): SessionEntry | undefined;
  getActiveSessionId(): string | null;
  addSession(session: SessionEntry): Promise<void>;
  updateSessionTitle(sessionId: string, title: string): Promise<void>;
  setActiveSession(sessionId: string): Promise<void>;
  removeSession(sessionId: string): Promise<void>;
  clearAll(): Promise<void>;
}

export function createSessionStorage(globalState: vscode.Memento): SessionStorage {
  const loadSessions = (): SessionEntry[] => {
    const data = globalState.get<SessionStorageData>(STORAGE_KEY_SESSIONS);
    if (!data || data.schemaVersion !== CURRENT_SCHEMA_VERSION) {
      return [];
    }
    return [...data.sessions];
  };

  const saveSessions = async (sessions: SessionEntry[]): Promise<void> => {
    const data: SessionStorageData = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      activeSessionId: getActiveSessionId(),
      sessions,
    };
    await globalState.update(STORAGE_KEY_SESSIONS, data);
  };

  const getSessions = (): readonly SessionEntry[] => {
    return loadSessions();
  };

  const getSession = (sessionId: string): SessionEntry | undefined => {
    const sessions = loadSessions();
    return sessions.find(s => s.sessionId === sessionId);
  };

  const getActiveSessionId = (): string | null => {
    return globalState.get<string | null>(STORAGE_KEY_ACTIVE, null);
  };

  const addSession = async (session: SessionEntry): Promise<void> => {
    const sessions = loadSessions();
    const existing = sessions.findIndex(s => s.sessionId === session.sessionId);
    if (existing >= 0) {
      sessions[existing] = session;
    } else {
      sessions.unshift(session);
    }
    await saveSessions(sessions);
  };

  const updateSessionTitle = async (sessionId: string, title: string): Promise<void> => {
    const sessions = loadSessions();
    const index = sessions.findIndex(s => s.sessionId === sessionId);
    if (index >= 0) {
      sessions[index] = { ...sessions[index], title };
      await saveSessions(sessions);
    }
  };

  const setActiveSession = async (sessionId: string): Promise<void> => {
    await globalState.update(STORAGE_KEY_ACTIVE, sessionId);
  };

  const removeSession = async (sessionId: string): Promise<void> => {
    const sessions = loadSessions().filter(s => s.sessionId !== sessionId);
    await saveSessions(sessions);
    const activeId = getActiveSessionId();
    if (activeId === sessionId) {
      await globalState.update(STORAGE_KEY_ACTIVE, null);
    }
  };

  const clearAll = async (): Promise<void> => {
    await globalState.update(STORAGE_KEY_SESSIONS, undefined);
    await globalState.update(STORAGE_KEY_ACTIVE, undefined);
  };

  return {
    getSessions,
    getSession,
    getActiveSessionId,
    addSession,
    updateSessionTitle,
    setActiveSession,
    removeSession,
    clearAll,
  };
}
