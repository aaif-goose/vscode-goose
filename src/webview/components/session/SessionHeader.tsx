/**
 * Session header component showing active session and action buttons.
 */

import { SessionEntry } from '../../../shared/sessionTypes';

interface SessionHeaderProps {
  activeSession: SessionEntry | null;
  hasMessages: boolean;
  onHistoryClick: () => void;
  onNewSessionClick: () => void;
}

export function SessionHeader({
  activeSession,
  hasMessages,
  onHistoryClick,
  onNewSessionClick,
}: SessionHeaderProps) {
  // Show stored title only if there are messages, otherwise show "New Session"
  const displayTitle = hasMessages ? (activeSession?.title ?? 'New Session') : 'New Session';

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] relative z-10">
      <span
        className="text-sm text-[var(--vscode-foreground)] truncate max-w-[160px]"
        title={displayTitle}
      >
        {displayTitle}
      </span>

      <div className="flex items-center gap-1">
        {hasMessages && (
          <button
            type="button"
            onClick={onNewSessionClick}
            className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--vscode-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded transition-colors"
            aria-label="New chat"
            title="New chat"
          >
            {/* Chat bubble icon */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 2.5h10A1.5 1.5 0 0 1 14.5 4v6a1.5 1.5 0 0 1-1.5 1.5H9l-3 2.5v-2.5H3A1.5 1.5 0 0 1 1.5 10V4A1.5 1.5 0 0 1 3 2.5Z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>New Chat</span>
          </button>
        )}

        <button
          type="button"
          onClick={onHistoryClick}
          className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--vscode-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded transition-colors"
          aria-label="View history"
          title="View history"
        >
          {/* History/clock icon */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
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
          <span>History</span>
        </button>
      </div>
    </div>
  );
}
