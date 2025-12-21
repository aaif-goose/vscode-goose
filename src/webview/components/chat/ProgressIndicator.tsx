interface ProgressIndicatorProps {
  className?: string;
}

export function ProgressIndicator({ className = '' }: ProgressIndicatorProps) {
  return (
    <div
      className={`flex items-center gap-1.5 ${className}`}
      role="status"
      aria-busy="true"
      aria-label="Generating response"
    >
      <span className="typing-indicator">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </span>
      <span className="sr-only">Goose is thinking...</span>
    </div>
  );
}
