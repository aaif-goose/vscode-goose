interface SendButtonProps {
  onClick: () => void;
  disabled: boolean;
}

export function SendButton({ onClick, disabled }: SendButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-2 bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded-lg hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      aria-label="Send message"
    >
      <SendIcon className="w-4 h-4" />
      <span className="text-sm font-medium">Send</span>
    </button>
  );
}

function SendIcon({ className }: { className?: string }) {
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
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
      />
    </svg>
  );
}
