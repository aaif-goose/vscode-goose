/**
 * Goose watermark component for empty state background.
 * Uses the goose icon path from resources/goose-icon-dark.svg.
 * Inherits color from theme via currentColor.
 */

interface GooseWatermarkProps {
  className?: string;
}

// Path from goose-icon-dark.svg - uses full 0-16 coordinate space
const GOOSE_PATH =
  'M13.5 13.5c1-.3 1.6-.8 1.6-.8l-1.6-1.2c-.8-.5-1.4-1.3-1.8-2.1-.7-1.1-1.5-2-2.6-2.7l-.5-.3c-.2-.1-.3-.3-.3-.5 0-.2 0-.3.1-.4.3-.4 1.8-.8 2-.1.3-.3.7-.5 1-.7l.2-.2c.1-.1.2-.2.3-.3.3-.3.4-.6.4-.8 0-.1-.1-.4-.5-.7.2 0 .4.2.7.4.2-.2.3-.5.5-.8.1-.2 0-.3 0-.3s-.1-.2-.3 0c-.4.2-.7.5-1.1.7 0 0-.4 0-.9.4-.1.1-.2.2-.3.3 0 0 0 0 0 0 0 .1-.1.1-.1.1-.3.3-.5.7-.8 1.1-.2.3-1.9 1.7-2.3 2-.1.1-.2.1-.4.1-.2 0-.4-.1-.5-.3l-.3-.5c-.7-1.1-1.6-2-2.7-2.7-.8-.5-1.5-1.1-2.1-1.8L.9 1.8S.5 2.7.3 3.7c.2.3.8 1 1.6 1.6-.8-.4-1.3-.6-1.8-.9-.1.5 0 1.3 0 1.9.5.2 1.3.5 2.1.7-.7.2-1.4.2-2 .2.1.4.2.8.4 1.1.1.2.2.4.3.5.3.1 1.4.3 2.1.1-.6.2-1.7.6-1.7.6.8 1 1.7 1.8 1.7 1.8 1.4-.7 1.7-.8 2.7-1.5C4.2 11 3.8 11.5 3.3 12l-.3.5c-.2.2-.3.5-.4.7-.4.9-1 2.8-1 2.8-.1.3.1.6.4.5 0 0 1.9-.6 2.8-1 .3-.1.5-.3.7-.4l.5-.3c.1-.1.3-.3.5-.4 0 0 1.2 1.4 2.3 2.3 0 0 .4-1.1.6-1.7-.1.6 0 1.8.1 2.1.2.1.3.2.5.3.4.2.8.3 1.1.4 0-.6 0-1.3.2-2 .2.9.5 1.7.7 2.2.6.1 1.4.1 1.9 0-.2-.5-.5-1-.9-1.8.6.7 1.3 1.4 1.6 1.6z';

export function GooseWatermark({ className = '' }: GooseWatermarkProps) {
  return (
    <div className={`pointer-events-none select-none w-[70%] ${className}`}>
      <svg
        className="w-full h-auto"
        viewBox="0 0 16 16"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        style={{ opacity: 0.08 }}
      >
        <path d={GOOSE_PATH} fill="currentColor" />
      </svg>
    </div>
  );
}
