/**
 * Session card component for displaying a session in the list.
 */

import { formatSessionTime, SessionEntry, truncatePath } from '../../../shared/sessionTypes';

interface SessionCardProps {
  session: SessionEntry;
  isActive: boolean;
  onClick: () => void;
}

export function SessionCard({ session, isActive, onClick }: SessionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full text-left p-3 rounded-md transition-colors
        ${
          isActive
            ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
            : 'bg-[var(--vscode-list-hoverBackground)] hover:bg-[var(--vscode-list-activeSelectionBackground)] hover:bg-opacity-50'
        }
      `}
      aria-current={isActive ? 'true' : undefined}
    >
      <div className="font-medium text-sm line-clamp-2 mb-2">{session.title}</div>
      <div className="flex items-center gap-3 text-xs text-[var(--vscode-descriptionForeground)]">
        <span className="flex items-center gap-1">
          <svg
            width="12"
            height="12"
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
          {formatSessionTime(session.createdAt)}
        </span>
        <span className="flex items-center gap-1 truncate" title={session.cwd}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="opacity-70 flex-shrink-0"
          >
            <path
              d="M2 4.5C2 3.67157 2.67157 3 3.5 3H6.5L8 4.5H12.5C13.3284 4.5 14 5.17157 14 6V11.5C14 12.3284 13.3284 13 12.5 13H3.5C2.67157 13 2 12.3284 2 11.5V4.5Z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="truncate">{truncatePath(session.cwd)}</span>
        </span>
      </div>
    </button>
  );
}
