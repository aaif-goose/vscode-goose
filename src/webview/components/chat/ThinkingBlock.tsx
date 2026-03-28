import { ThinkingPart } from '../../../shared/types';
import { MarkdownRenderer } from '../markdown/MarkdownRenderer';

interface ThinkingBlockProps {
  part: ThinkingPart;
}

export function ThinkingBlock({ part }: ThinkingBlockProps) {
  if (!part.text.trim()) {
    return (
      <div className="rounded-lg border border-[var(--vscode-widget-border)] bg-[var(--vscode-sideBar-background)]/40 px-3 py-2 text-sm italic text-[var(--vscode-descriptionForeground)]">
        Thinking...
      </div>
    );
  }

  return (
    <details
      className="rounded-lg border border-[var(--vscode-widget-border)] bg-[var(--vscode-sideBar-background)]/40"
      open={part.streaming}
    >
      <summary className="cursor-pointer list-none px-3 py-2 text-sm text-[var(--vscode-descriptionForeground)]">
        {part.streaming ? 'Thinking...' : 'Thought process'}
      </summary>
      <div className="px-3 pb-3 pt-0 text-sm text-[var(--vscode-descriptionForeground)]">
        <MarkdownRenderer content={part.text} isStreaming={part.streaming} />
      </div>
    </details>
  );
}
