import { ToolCallPart } from '../../../shared/types';

interface ToolCallCardProps {
  part: ToolCallPart;
}

const STATUS_LABELS: Record<ToolCallPart['status'], string> = {
  pending: 'Pending',
  in_progress: 'Running',
  completed: 'Completed',
  failed: 'Failed',
};

const STATUS_COLORS: Record<ToolCallPart['status'], string> = {
  pending: 'text-[var(--vscode-descriptionForeground)]',
  in_progress: 'text-[var(--vscode-charts-yellow)]',
  completed: 'text-[var(--vscode-testing-iconPassed)]',
  failed: 'text-[var(--vscode-errorForeground)]',
};

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  try {
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function ToolCallCard({ part }: ToolCallCardProps) {
  const inputText = formatValue(part.rawInput);
  const outputText = formatValue(part.rawOutput);
  const previewText = part.contentPreview?.join('\n') ?? '';
  const hasDetails = Boolean(
    inputText || outputText || previewText || (part.locations && part.locations.length > 0)
  );

  return (
    <details
      className="rounded-lg border border-[var(--vscode-widget-border)] bg-[var(--vscode-editorWidget-background)]/60"
      open={part.status === 'in_progress'}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--vscode-foreground)]">
            {part.title}
          </p>
          <p className="truncate text-xs text-[var(--vscode-descriptionForeground)]">
            {part.kind ? `${part.kind} tool` : 'Tool call'}
          </p>
        </div>
        <span className={`shrink-0 text-xs font-medium ${STATUS_COLORS[part.status]}`}>
          {STATUS_LABELS[part.status]}
        </span>
      </summary>
      {hasDetails && (
        <div className="space-y-3 border-t border-[var(--vscode-widget-border)] px-3 py-3">
          {part.locations && part.locations.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
                Locations
              </p>
              <div className="space-y-1">
                {part.locations.map(location => (
                  <p
                    key={`${location.path}:${location.line ?? ''}`}
                    className="font-mono text-xs text-[var(--vscode-descriptionForeground)]"
                  >
                    {location.path}
                    {location.line ? `:${location.line}` : ''}
                  </p>
                ))}
              </div>
            </div>
          )}
          {inputText && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
                Input
              </p>
              <pre className="overflow-x-auto rounded bg-[var(--vscode-textCodeBlock-background)] p-2 text-xs text-[var(--vscode-foreground)]">
                {inputText}
              </pre>
            </div>
          )}
          {previewText && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
                Preview
              </p>
              <pre className="overflow-x-auto rounded bg-[var(--vscode-textCodeBlock-background)] p-2 text-xs text-[var(--vscode-foreground)]">
                {previewText}
              </pre>
            </div>
          )}
          {outputText && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
                Output
              </p>
              <pre className="overflow-x-auto rounded bg-[var(--vscode-textCodeBlock-background)] p-2 text-xs text-[var(--vscode-foreground)]">
                {outputText}
              </pre>
            </div>
          )}
        </div>
      )}
    </details>
  );
}
