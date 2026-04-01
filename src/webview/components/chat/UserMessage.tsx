import { getLanguageFromPath, parseContent } from '../../../shared/fileReferenceParser';
import { MessageContext } from '../../../shared/types';
import { FileTypeIcon } from '../icons/FileTypeIcon';
import { MarkdownRenderer } from '../markdown/MarkdownRenderer';
import { FileReferenceCard } from './FileReferenceCard';

interface UserMessageProps {
  content: string;
  timestamp?: Date;
  context?: readonly MessageContext[];
  isFocused?: boolean;
}

function formatTime(date?: Date): string {
  if (!date) return 'Earlier';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatContextLabel(ctx: MessageContext): string {
  if (ctx.range) {
    return `${ctx.fileName}:${ctx.range.startLine}-${ctx.range.endLine}`;
  }
  return ctx.fileName;
}

export function UserMessage({ content, timestamp, context, isFocused = false }: UserMessageProps) {
  const hasTextContent = content.trim().length > 0;
  const hasContext = context && context.length > 0;

  // Check if content is a file reference (from history)
  const parsedContent = parseContent(content);
  const isFileReference = parsedContent.type === 'file_reference';

  return (
    <div className="flex flex-col items-end">
      <div className="ml-auto flex w-fit max-w-[80%] flex-col items-end">
        {/* Context badges - same UI for input and history */}
        {hasContext && (
          <div className="flex flex-wrap gap-1 justify-end mb-1">
            {context.map((ctx, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]"
                title={ctx.filePath}
              >
                <FileTypeIcon
                  languageId={getLanguageFromPath(ctx.filePath)}
                  className="w-3 h-3 flex-shrink-0"
                />
                {formatContextLabel(ctx)}
              </span>
            ))}
          </div>
        )}

        {/* File reference content */}
        {isFileReference && parsedContent.type === 'file_reference' ? (
          <FileReferenceCard reference={parsedContent.reference} />
        ) : hasTextContent ? (
          /* Text content */
          <div
            className={`max-w-full rounded-2xl bg-[var(--vscode-button-background)] px-4 py-2 text-left text-[var(--vscode-button-foreground)] transition-shadow ${
              isFocused
                ? 'ring-2 ring-[var(--vscode-focusBorder)] ring-offset-2 ring-offset-[var(--vscode-editor-background)]'
                : ''
            }`}
          >
            <MarkdownRenderer content={content} variant="bubble" />
          </div>
        ) : null}

        <p
          className={`mt-1 text-right text-[11px] text-[var(--vscode-descriptionForeground)] ${!timestamp ? 'italic' : ''}`}
        >
          {formatTime(timestamp)}
        </p>
      </div>
    </div>
  );
}
