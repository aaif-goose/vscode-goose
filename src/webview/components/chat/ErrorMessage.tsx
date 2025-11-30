interface ErrorMessageProps {
  content: string;
  timestamp: Date;
  onRetry?: (content: string) => void;
  originalContent?: string;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function ErrorMessage({ content, timestamp, onRetry, originalContent }: ErrorMessageProps) {
  const canRetry = onRetry && originalContent;

  return (
    <div className="flex flex-col items-start">
      <div className="w-full p-3 bg-[var(--vscode-inputValidation-errorBackground,rgba(255,0,0,0.1))] border border-[var(--vscode-inputValidation-errorBorder,var(--vscode-errorForeground))] rounded-lg">
        <div className="flex items-start gap-2">
          <ErrorIcon className="w-4 h-4 text-[var(--vscode-errorForeground)] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[var(--vscode-errorForeground)] text-sm">{content}</p>
            {canRetry && (
              <button
                onClick={() => onRetry(originalContent)}
                className="mt-2 text-xs text-[var(--vscode-textLink-foreground,#3794ff)] hover:text-[var(--vscode-textLink-activeForeground,#3794ff)] hover:underline flex items-center gap-1"
                aria-label="Retry sending message"
              >
                <RetryIcon className="w-3 h-3" />
                <span>Retry</span>
              </button>
            )}
          </div>
        </div>
      </div>
      <p className="text-xs text-[var(--vscode-descriptionForeground)] mt-1">
        {formatTime(timestamp)}
      </p>
    </div>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function RetryIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}
