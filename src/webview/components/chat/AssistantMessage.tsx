import { useState } from 'react';
import { MessageStatus } from '../../../shared/types';

interface AssistantMessageProps {
  content: string;
  timestamp: Date;
  status: MessageStatus;
  onCopy: () => void;
  isStreaming: boolean;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function AssistantMessage({
  content,
  timestamp,
  status,
  onCopy,
  isStreaming,
}: AssistantMessageProps) {
  const [showCopied, setShowCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-start group">
      <div className="w-full">
        <div className="relative">
          <div className="prose prose-invert max-w-none">
            <p className="whitespace-pre-wrap break-words text-[var(--vscode-foreground)]">
              {content}
              {isStreaming && (
                <span className="inline-block w-2 h-4 ml-1 bg-[var(--vscode-foreground)] animate-pulse" />
              )}
            </p>
          </div>
          {!isStreaming && content && (
            <button
              onClick={handleCopy}
              className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--vscode-toolbar-hoverBackground)]"
              aria-label="Copy message"
              title={showCopied ? 'Copied!' : 'Copy'}
            >
              {showCopied ? (
                <CheckIcon className="w-4 h-4 text-[var(--vscode-testing-iconPassed)]" />
              ) : (
                <CopyIcon className="w-4 h-4 text-[var(--vscode-foreground)]" />
              )}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-[var(--vscode-descriptionForeground)]">
            {formatTime(timestamp)}
          </p>
          {status === MessageStatus.CANCELLED && (
            <span className="text-xs text-[var(--vscode-descriptionForeground)] italic">
              (cancelled)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}
