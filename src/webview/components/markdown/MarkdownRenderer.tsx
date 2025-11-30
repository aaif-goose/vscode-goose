import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { CodeBlock } from './CodeBlock';
import { postMessage } from '../../bridge';
import { WebviewMessageType } from '../../../shared/messages';

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
  variant?: 'default' | 'bubble';
}

function createComponents(variant: 'default' | 'bubble'): Components {
  const isBubble = variant === 'bubble';

  const textColor = isBubble ? 'text-inherit' : 'text-[var(--vscode-foreground)]';
  const mutedColor = isBubble
    ? 'text-inherit opacity-70'
    : 'text-[var(--vscode-foreground)] opacity-70';
  const linkColor = isBubble
    ? 'text-inherit underline hover:opacity-80'
    : 'text-[var(--vscode-textLink-foreground,#3794ff)] hover:underline';
  const borderColor = isBubble ? 'border-current/30' : 'border-[var(--vscode-foreground)]/20';
  const blockquoteBorder = isBubble ? 'border-current/50' : 'border-[var(--vscode-foreground)]/40';
  const inlineCodeBg = isBubble ? 'bg-black/20' : 'bg-[var(--vscode-foreground)]/10';
  const tableBg = isBubble ? 'bg-black/10' : 'bg-[var(--vscode-foreground)]/5';

  return {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const isInline = !match && !className;
      const code = String(children).replace(/\n$/, '');

      if (isInline) {
        return (
          <code
            className={`px-1.5 py-0.5 rounded text-sm font-mono ${inlineCodeBg} ${textColor}`}
            {...props}
          >
            {children}
          </code>
        );
      }

      return <CodeBlock code={code} language={match?.[1]} variant={variant} />;
    },

    a({ href, children, ...props }) {
      const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (href) {
          postMessage({
            type: WebviewMessageType.OPEN_EXTERNAL_LINK,
            payload: { url: href },
          });
        }
      };

      return (
        <a href={href} onClick={handleClick} className={linkColor} {...props}>
          {children}
        </a>
      );
    },

    h1({ children, ...props }) {
      return (
        <h1 className={`text-2xl font-semibold mt-6 mb-3 ${textColor}`} {...props}>
          {children}
        </h1>
      );
    },

    h2({ children, ...props }) {
      return (
        <h2 className={`text-xl font-semibold mt-5 mb-2 ${textColor}`} {...props}>
          {children}
        </h2>
      );
    },

    h3({ children, ...props }) {
      return (
        <h3 className={`text-lg font-semibold mt-4 mb-2 ${textColor}`} {...props}>
          {children}
        </h3>
      );
    },

    h4({ children, ...props }) {
      return (
        <h4 className={`text-base font-semibold mt-4 mb-1 ${textColor}`} {...props}>
          {children}
        </h4>
      );
    },

    h5({ children, ...props }) {
      return (
        <h5 className={`text-sm font-semibold mt-3 mb-1 ${textColor}`} {...props}>
          {children}
        </h5>
      );
    },

    h6({ children, ...props }) {
      return (
        <h6 className={`text-sm font-medium mt-3 mb-1 ${mutedColor}`} {...props}>
          {children}
        </h6>
      );
    },

    p({ children, ...props }) {
      return (
        <p className={`my-2 leading-relaxed ${textColor}`} {...props}>
          {children}
        </p>
      );
    },

    ul({ children, ...props }) {
      return (
        <ul className="my-2 ml-4 list-disc space-y-1" {...props}>
          {children}
        </ul>
      );
    },

    ol({ children, ...props }) {
      return (
        <ol className="my-2 ml-4 list-decimal space-y-1" {...props}>
          {children}
        </ol>
      );
    },

    li({ children, ...props }) {
      return (
        <li className={textColor} {...props}>
          {children}
        </li>
      );
    },

    blockquote({ children, ...props }) {
      return (
        <blockquote
          className={`my-3 pl-4 border-l-4 ${blockquoteBorder} ${isBubble ? textColor : 'text-[var(--vscode-textBlockQuote-foreground)]'} italic`}
          {...props}
        >
          {children}
        </blockquote>
      );
    },

    table({ children, ...props }) {
      return (
        <div className="my-3 overflow-x-auto">
          <table className={`min-w-full border-collapse border ${borderColor}`} {...props}>
            {children}
          </table>
        </div>
      );
    },

    thead({ children, ...props }) {
      return (
        <thead className={tableBg} {...props}>
          {children}
        </thead>
      );
    },

    th({ children, ...props }) {
      return (
        <th
          className={`px-3 py-2 text-left text-sm font-semibold ${textColor} border ${borderColor}`}
          {...props}
        >
          {children}
        </th>
      );
    },

    td({ children, ...props }) {
      return (
        <td className={`px-3 py-2 text-sm ${textColor} border ${borderColor}`} {...props}>
          {children}
        </td>
      );
    },

    hr({ ...props }) {
      return <hr className={`my-4 border-t ${borderColor}`} {...props} />;
    },

    strong({ children, ...props }) {
      return (
        <strong className="font-semibold" {...props}>
          {children}
        </strong>
      );
    },

    em({ children, ...props }) {
      return (
        <em className="italic" {...props}>
          {children}
        </em>
      );
    },

    del({ children, ...props }) {
      return (
        <del className={`line-through ${mutedColor}`} {...props}>
          {children}
        </del>
      );
    },
  };
}

export function MarkdownRenderer({
  content,
  isStreaming = false,
  variant = 'default',
}: MarkdownRendererProps) {
  const components = createComponents(variant);

  return (
    <div className="markdown-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
      {isStreaming && <span className="inline-block w-2 h-4 ml-0.5 bg-current animate-pulse" />}
    </div>
  );
}
