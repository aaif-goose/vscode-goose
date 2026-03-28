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
  pending: 'text-[var(--vscode-descriptionForeground)] bg-[var(--vscode-badge-background)]/50',
  in_progress: 'text-[var(--vscode-charts-yellow)] bg-[var(--vscode-editorWidget-background)]',
  completed: 'text-[var(--vscode-testing-iconPassed)] bg-[var(--vscode-editorWidget-background)]',
  failed:
    'text-[var(--vscode-errorForeground)] bg-[var(--vscode-inputValidation-errorBackground,rgba(255,0,0,0.08))]',
};

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  try {
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalizeSingleLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function formatInlineValue(value: unknown): string {
  if (value === undefined || value === null) return '';

  if (typeof value === 'string') {
    return `"${normalizeSingleLine(value)}"`;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map(item => formatInlineValue(item))
      .filter(Boolean)
      .join(', ');
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '';

    return entries
      .slice(0, 4)
      .map(([key, entryValue]) => `${key}=${formatInlineValue(entryValue)}`)
      .join(', ');
  }

  return String(value);
}

function getInlineInputPreview(part: ToolCallPart): string | undefined {
  const preview = formatInlineValue(part.rawInput);
  if (!preview) return undefined;
  return truncateText(preview, 110);
}

export function ToolCallCard({ part }: ToolCallCardProps) {
  const inputText = formatValue(part.rawInput);
  const outputText = formatValue(part.rawOutput);
  const previewText = part.contentPreview?.join('\n') ?? '';
  const inlineInputPreview = getInlineInputPreview(part);
  const hasDetails = Boolean(inputText || outputText || previewText);
  const shouldOpenByDefault = part.status === 'in_progress';

  return (
    <details
      className="rounded-lg border border-[color:color-mix(in_srgb,var(--vscode-widget-border)_70%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editorWidget-background)_45%,transparent)]"
      open={shouldOpenByDefault}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2">
        <div className="min-w-0 flex flex-1 items-center gap-2">
          <span
            className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
              part.status === 'completed'
                ? 'bg-[var(--vscode-testing-iconPassed)]'
                : part.status === 'failed'
                  ? 'bg-[var(--vscode-errorForeground)]'
                  : part.status === 'in_progress'
                    ? 'bg-[var(--vscode-charts-yellow)]'
                    : 'bg-[var(--vscode-descriptionForeground)]'
            }`}
            aria-hidden="true"
          />
          <p className="min-w-0 truncate leading-5">
            <span className="text-[13px] font-medium text-[var(--vscode-foreground)]">
              {part.title}
            </span>
            {inlineInputPreview && (
              <>
                <span aria-hidden="true" className="inline-block w-2" />
                <span className="font-mono text-[11px] text-[var(--vscode-descriptionForeground)]">
                  {inlineInputPreview}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[part.status]}`}
          >
            {STATUS_LABELS[part.status]}
          </span>
          {hasDetails && (
            <span className="text-[11px] text-[var(--vscode-descriptionForeground)]">Details</span>
          )}
        </div>
      </summary>
      {hasDetails && (
        <div className="space-y-3.5 border-t border-[color:color-mix(in_srgb,var(--vscode-widget-border)_60%,transparent)] px-3 py-3">
          {inputText && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
                Input
              </p>
              <pre className="overflow-x-auto rounded bg-[var(--vscode-textCodeBlock-background)] p-2 text-xs text-[var(--vscode-foreground)]">
                {inputText}
              </pre>
            </div>
          )}
          {previewText && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
                Result preview
              </p>
              <pre className="overflow-x-auto rounded bg-[var(--vscode-textCodeBlock-background)] p-2 text-xs text-[var(--vscode-foreground)]">
                {previewText}
              </pre>
            </div>
          )}
          {outputText && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
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
