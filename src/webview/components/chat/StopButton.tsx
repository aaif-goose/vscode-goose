interface StopButtonProps {
  onClick: () => void;
}

export function StopButton({ onClick }: StopButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-2 bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] rounded-lg hover:bg-[var(--vscode-button-secondaryHoverBackground)] transition-colors"
      aria-label="Stop generation"
    >
      <StopIcon className="w-4 h-4" />
      <span className="text-sm font-medium">Stop</span>
    </button>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
