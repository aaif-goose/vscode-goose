import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CopyButton } from './CopyButton';

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  variant?: 'default' | 'bubble';
}

const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  rb: 'ruby',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  md: 'markdown',
};

function normalizeLanguage(lang?: string): string {
  if (!lang) return 'text';
  const lower = lang.toLowerCase();
  return LANGUAGE_ALIASES[lower] ?? lower;
}

export function CodeBlock({
  code,
  language,
  showLineNumbers = false,
  variant = 'default',
}: CodeBlockProps) {
  const normalizedLang = normalizeLanguage(language);
  const isBubble = variant === 'bubble';

  const containerClasses = isBubble
    ? 'group relative my-3 rounded-md overflow-hidden border border-current/30'
    : 'group relative my-3 rounded-md overflow-hidden border border-[var(--vscode-foreground)]/20';

  const headerClasses = isBubble
    ? 'flex items-center justify-between px-3 py-1.5 bg-[#1e1e1e] border-b border-white/10'
    : 'flex items-center justify-between px-3 py-1.5 bg-[var(--vscode-foreground)]/5 border-b border-[var(--vscode-foreground)]/20';

  const labelClasses = isBubble
    ? 'text-xs text-white/70 font-mono'
    : 'text-xs text-[var(--vscode-foreground)] opacity-70 font-mono';

  return (
    <div className={containerClasses}>
      <div className={headerClasses}>
        <span className={labelClasses}>{normalizedLang}</span>
        <CopyButton
          text={code}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          variant={variant}
        />
      </div>
      <SyntaxHighlighter
        language={normalizedLang}
        style={vscDarkPlus}
        showLineNumbers={showLineNumbers}
        customStyle={{
          margin: 0,
          padding: '0.75rem 1rem',
          fontSize: '13px',
          lineHeight: '1.5',
          background: isBubble ? 'rgba(30, 30, 30, 0.95)' : 'var(--vscode-editor-background)',
        }}
        codeTagProps={{
          style: {
            fontFamily: 'var(--vscode-editor-font-family, monospace)',
          },
        }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
