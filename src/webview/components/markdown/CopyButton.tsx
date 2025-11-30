import { useState, useCallback } from 'react';

interface CopyButtonProps {
  text: string;
  className?: string;
  variant?: 'default' | 'bubble';
}

export function CopyButton({ text, className = '', variant = 'default' }: CopyButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const isBubble = variant === 'bubble';

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('copied');
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    }
  }, [text]);

  const baseClasses =
    'flex items-center gap-1 px-2 py-1 rounded text-xs transition-all duration-150';
  const hoverClasses =
    status === 'idle'
      ? isBubble
        ? 'hover:bg-white/10'
        : 'hover:bg-[var(--vscode-toolbar-hoverBackground)]'
      : '';
  const colorClasses = isBubble
    ? status === 'copied'
      ? 'text-green-400'
      : status === 'error'
        ? 'text-red-400'
        : 'text-white/70'
    : status === 'copied'
      ? 'text-[var(--vscode-testing-iconPassed)]'
      : status === 'error'
        ? 'text-[var(--vscode-errorForeground)]'
        : 'text-[var(--vscode-foreground)]';

  return (
    <button
      onClick={handleCopy}
      className={`${baseClasses} ${hoverClasses} ${colorClasses} ${className}`}
      aria-label={
        status === 'copied' ? 'Copied!' : status === 'error' ? 'Copy failed' : 'Copy code'
      }
      title={status === 'copied' ? 'Copied!' : status === 'error' ? 'Failed to copy' : 'Copy'}
    >
      {status === 'copied' ? (
        <>
          <CheckIcon className="w-3.5 h-3.5" />
          <span>Copied!</span>
        </>
      ) : status === 'error' ? (
        <>
          <ErrorIcon className="w-3.5 h-3.5" />
          <span>Failed</span>
        </>
      ) : (
        <>
          <CopyIcon className="w-3.5 h-3.5" />
          <span>Copy</span>
        </>
      )}
    </button>
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
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
