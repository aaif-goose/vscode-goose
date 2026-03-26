/**
 * Session management types for the VS Code Goose extension.
 * Defines session storage and metadata structures.
 */

/** Stored session metadata (persisted locally - minimal data only) */
export interface SessionEntry {
  readonly sessionId: string;
  readonly title: string;
  readonly cwd: string;
  readonly createdAt: string;
}

/** Session storage schema */
export interface SessionStorageData {
  readonly schemaVersion: 1;
  readonly activeSessionId: string | null;
  readonly sessions: readonly SessionEntry[];
}

/** Agent capabilities from ACP initialize response */
export interface AgentCapabilities {
  readonly loadSession: boolean;
  readonly promptCapabilities: {
    readonly image: boolean;
    readonly audio: boolean;
    readonly embeddedContext: boolean;
  };
}

/** Option value for a session setting selector. */
export interface SessionSettingOption {
  readonly value: string;
  readonly name: string;
  readonly description?: string;
}

/** Select-style session setting exposed by the ACP agent. */
export interface SessionSelectSetting {
  readonly id: string;
  readonly label: string;
  readonly category: 'mode' | 'model' | 'other';
  readonly currentValue: string;
  readonly options: readonly SessionSettingOption[];
  readonly description?: string;
}

/** Session settings state surfaced to the webview for the active session. */
export interface SessionSettingsState {
  readonly mode: SessionSelectSetting | null;
  readonly model: SessionSelectSetting | null;
}

/** Empty session settings state. */
export const EMPTY_SESSION_SETTINGS: SessionSettingsState = {
  mode: null,
  model: null,
};

/** Session list grouped by date for UI */
export interface GroupedSessions {
  readonly label: string;
  readonly sessions: readonly SessionEntry[];
}

/** Default capabilities - loadSession enabled for modern goose versions */
export const DEFAULT_CAPABILITIES: AgentCapabilities = {
  loadSession: true,
  promptCapabilities: {
    image: false,
    audio: false,
    embeddedContext: false,
  },
};

/** Generate a session title from the first message content */
export function generateSessionTitle(firstMessage: string): string {
  const maxLength = 50;
  const trimmed = firstMessage.trim();

  if (!trimmed) return 'New Session';
  if (trimmed.length <= maxLength) return trimmed;

  const truncated = trimmed.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  return lastSpace > 20 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
}

/** Group sessions by date for display */
export function groupSessionsByDate(sessions: readonly SessionEntry[]): GroupedSessions[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  const groups = new Map<string, SessionEntry[]>();

  for (const session of sessions) {
    const sessionDate = new Date(session.createdAt);
    const sessionDay = new Date(
      sessionDate.getFullYear(),
      sessionDate.getMonth(),
      sessionDate.getDate()
    );

    let label: string;
    if (sessionDay.getTime() === today.getTime()) {
      label = 'Today';
    } else if (sessionDay.getTime() === yesterday.getTime()) {
      label = 'Yesterday';
    } else {
      label = sessionDay.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }

    const existing = groups.get(label);
    if (existing) {
      existing.push(session);
    } else {
      groups.set(label, [session]);
    }
  }

  const sortedEntries = Array.from(groups.entries()).sort(([a], [b]) => {
    if (a === 'Today') return -1;
    if (b === 'Today') return 1;
    if (a === 'Yesterday') return -1;
    if (b === 'Yesterday') return 1;
    return new Date(b).getTime() - new Date(a).getTime();
  });

  return sortedEntries.map(([label, groupSessions]) => ({
    label,
    sessions: [...groupSessions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
  }));
}

/** Format a timestamp for display */
export function formatSessionTime(createdAt: string): string {
  const date = new Date(createdAt);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Truncate a path for display */
export function truncatePath(path: string, maxLength: number = 30): string {
  if (path.length <= maxLength) return path;

  const parts = path.split('/').filter(Boolean);
  if (parts.length <= 2) return '.../' + parts.join('/');

  return '.../' + parts.slice(-2).join('/');
}
