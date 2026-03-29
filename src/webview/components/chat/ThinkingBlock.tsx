import { ThinkingPart } from '../../../shared/types';
import { MarkdownRenderer } from '../markdown/MarkdownRenderer';

interface ThinkingBlockProps {
  part: ThinkingPart;
}

export function ThinkingBlock({ part }: ThinkingBlockProps) {
  if (!part.text.trim()) {
    return (
      <div className="py-0.5 text-[13px] italic text-[var(--vscode-descriptionForeground)] opacity-70">
        Thinking:
      </div>
    );
  }

  if (part.streaming) {
    return (
      <div className="py-0.5 text-[13px] italic text-[var(--vscode-descriptionForeground)] opacity-70">
        <p className="mb-0.5">Thinking:</p>
        <div className="pl-4">
          <MarkdownRenderer content={part.text} isStreaming={part.streaming} />
        </div>
      </div>
    );
  }

  return (
    <details className="py-0.5">
      <summary className="cursor-pointer list-none text-[13px] italic text-[var(--vscode-descriptionForeground)] opacity-70">
        Show reasoning
      </summary>
      <div className="pt-1 pl-4 text-[13px] italic text-[var(--vscode-descriptionForeground)] opacity-70">
        <MarkdownRenderer content={part.text} isStreaming={part.streaming} />
      </div>
    </details>
  );
}
