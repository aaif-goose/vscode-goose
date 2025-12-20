import { MarkdownRenderer } from '../markdown/MarkdownRenderer';

interface UserMessageProps {
  content: string;
  timestamp?: Date;
}

function formatTime(date?: Date): string {
  if (!date) return 'Earlier';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function UserMessage({ content, timestamp }: UserMessageProps) {
  return (
    <div className="flex flex-col items-end">
      <div className="ml-auto max-w-[80%]">
        <div className="bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded-2xl px-4 py-2">
          <MarkdownRenderer content={content} variant="bubble" />
        </div>
        <p className={`text-xs text-[var(--vscode-descriptionForeground)] mt-1 text-right ${!timestamp ? 'italic' : ''}`}>
          {formatTime(timestamp)}
        </p>
      </div>
    </div>
  );
}
