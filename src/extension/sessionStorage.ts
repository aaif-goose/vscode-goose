/**
 * Session storage for persisting the active session in VS Code globalState.
 */

import * as vscode from 'vscode';

const STORAGE_KEY_ACTIVE = 'goose.activeSession';

export interface SessionStorage {
  getActiveSessionId(): string | null;
  setActiveSession(sessionId: string): Promise<void>;
  clearActiveSession(): Promise<void>;
  clearAll(): Promise<void>;
}

export function createSessionStorage(globalState: vscode.Memento): SessionStorage {
  let activeSessionId = globalState.get<string | null>(STORAGE_KEY_ACTIVE, null);

  const getActiveSessionId = (): string | null => {
    return activeSessionId;
  };

  const setActiveSession = async (sessionId: string): Promise<void> => {
    activeSessionId = sessionId;
    await globalState.update(STORAGE_KEY_ACTIVE, sessionId);
  };

  const clearActiveSession = async (): Promise<void> => {
    activeSessionId = null;
    await globalState.update(STORAGE_KEY_ACTIVE, null);
  };

  const clearAll = async (): Promise<void> => {
    await clearActiveSession();
  };

  return {
    getActiveSessionId,
    setActiveSession,
    clearActiveSession,
    clearAll,
  };
}
