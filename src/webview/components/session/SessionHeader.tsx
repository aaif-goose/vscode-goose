/**
 * Session header component showing active session and action buttons.
 */

import { SessionEntry } from '../../../shared/sessionTypes';

interface SessionHeaderProps {
  activeSession: SessionEntry | null;
  onHistoryClick: () => void;
  onNewSessionClick: () => void;
}

export function SessionHeader({
  activeSession,
  onHistoryClick,
  onNewSessionClick,
}: SessionHeaderProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--vscode-panel-border)]">
      <button
        type="button"
        onClick={onHistoryClick}
        className="flex items-center gap-2 text-sm text-[var(--vscode-foreground)] hover:text-[var(--vscode-textLink-foreground)] transition-colors"
        aria-label="View chat history"
        title="View chat history"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="opacity-70"
        >
          <path
            d="M8 3.5V8L10.5 10.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        <span className="truncate max-w-[160px]" title={activeSession?.title}>
          {activeSession?.title ?? 'No session'}
        </span>
      </button>

      <button
        type="button"
        onClick={onNewSessionClick}
        className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--vscode-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded transition-colors"
        aria-label="Create new session"
        title="Create new session"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span>New</span>
      </button>
    </div>
  );
}
