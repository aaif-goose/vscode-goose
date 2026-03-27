/**
 * Session list component showing all sessions grouped by date.
 */

import { GroupedSessions } from '../../../shared/sessionTypes';
import { SessionCard } from './SessionCard';

interface SessionListProps {
  groupedSessions: readonly GroupedSessions[];
  activeSessionId: string | null;
  isLoading: boolean;
  onSelectSession: (sessionId: string) => void;
  onClose: () => void;
  onRefresh: () => void;
}

export function SessionList({
  groupedSessions,
  activeSessionId,
  isLoading,
  onSelectSession,
  onClose,
  onRefresh,
}: SessionListProps) {
  const isEmpty =
    groupedSessions.length === 0 || groupedSessions.every(g => g.sessions.length === 0);

  return (
    <div className="flex h-full flex-col bg-[var(--vscode-sideBar-background)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--vscode-panel-border)]">
        <div>
          <h2 className="text-base font-medium text-[var(--vscode-foreground)]">Sessions</h2>
          <p className="text-xs text-[var(--vscode-descriptionForeground)] mt-0.5">
            Select a session to continue
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onRefresh}
            className="p-1.5 text-[var(--vscode-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded transition-colors"
            aria-label="Refresh session list"
            title="Refresh"
            disabled={isLoading}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={isLoading ? 'animate-spin' : ''}
            >
              <path
                d="M13.5 8C13.5 11.0376 11.0376 13.5 8 13.5C4.96243 13.5 2.5 11.0376 2.5 8C2.5 4.96243 4.96243 2.5 8 2.5C9.73919 2.5 11.2826 3.31997 12.25 4.5625"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <path
                d="M13.5 2.5V5.5H10.5"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[var(--vscode-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded transition-colors"
            aria-label="Close session list"
            title="Close"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 4L12 12M4 12L12 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {isLoading && isEmpty ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-sm text-[var(--vscode-descriptionForeground)]">
              Loading sessions...
            </div>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <p className="text-sm text-[var(--vscode-descriptionForeground)] mb-2">
              No sessions yet
            </p>
            <p className="text-xs text-[var(--vscode-descriptionForeground)]">
              Start a conversation to create your first session
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedSessions.map(group => (
              <div key={group.label}>
                <h3 className="text-xs font-medium text-[var(--vscode-descriptionForeground)] uppercase tracking-wide mb-2 px-1">
                  {group.label}
                </h3>
                <div className="space-y-1">
                  {group.sessions.map(session => (
                    <SessionCard
                      key={session.sessionId}
                      session={session}
                      isActive={session.sessionId === activeSessionId}
                      onClick={() => onSelectSession(session.sessionId)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
