/**
 * Component for displaying version-related blocking messages.
 * Shows guidance for installing or updating Goose when version requirements are not met.
 */

import { postMessage } from '../bridge';
import { createOpenExternalLinkMessage } from '../../shared/messages';

export interface VersionBlockedViewProps {
  status: 'blocked_missing' | 'blocked_outdated';
  detectedVersion?: string;
  minimumVersion: string;
  installUrl?: string;
  updateUrl?: string;
}

export function VersionBlockedView({
  status,
  detectedVersion,
  minimumVersion,
  installUrl,
  updateUrl,
}: VersionBlockedViewProps) {
  const handleLinkClick = (url: string) => {
    postMessage(createOpenExternalLinkMessage(url));
  };

  if (status === 'blocked_missing') {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-6">
        <div className="max-w-md text-center">
          <GooseIcon className="w-12 h-12 mx-auto mb-4 text-[var(--vscode-foreground)] opacity-60" />
          <h2 className="text-lg font-medium text-[var(--vscode-foreground)] mb-3">
            Welcome to Goose
          </h2>
          <p className="text-sm text-[var(--vscode-descriptionForeground)] mb-4">
            To get started, you need to install Goose (version {minimumVersion} or higher) on your
            system.
          </p>
          {installUrl && (
            <button
              type="button"
              onClick={() => handleLinkClick(installUrl)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm text-[var(--vscode-button-foreground)] bg-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-hoverBackground)] rounded transition-colors"
            >
              <ExternalLinkIcon className="w-4 h-4" />
              View Installation Guide
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen p-6">
      <div className="max-w-md text-center">
        <UpdateIcon className="w-12 h-12 mx-auto mb-4 text-[var(--vscode-editorWarning-foreground)]" />
        <h2 className="text-lg font-medium text-[var(--vscode-foreground)] mb-3">
          Goose Update Required
        </h2>
        <p className="text-sm text-[var(--vscode-descriptionForeground)] mb-2">
          This extension requires Goose version {minimumVersion} or higher.
        </p>
        {detectedVersion && (
          <p className="text-sm text-[var(--vscode-descriptionForeground)] mb-4">
            Your current version:{' '}
            <span className="font-medium text-[var(--vscode-foreground)]">{detectedVersion}</span>
          </p>
        )}
        {updateUrl && (
          <button
            type="button"
            onClick={() => handleLinkClick(updateUrl)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-[var(--vscode-button-foreground)] bg-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-hoverBackground)] rounded transition-colors"
          >
            <ExternalLinkIcon className="w-4 h-4" />
            View Update Instructions
          </button>
        )}
      </div>
    </div>
  );
}

function GooseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3c-1.5 0-2.5 1-3 2-1 0-2 .5-2.5 1.5S6 8.5 6 10c0 1 .5 2 1 2.5-.5 1-1 2.5-1 4 0 2.5 2 4.5 6 4.5s6-2 6-4.5c0-1.5-.5-3-1-4 .5-.5 1-1.5 1-2.5 0-1.5-.5-2.5-1-3.5s-1.5-1.5-2.5-1.5c-.5-1-1.5-2-3-2z" />
      <circle cx="10" cy="10" r="1" fill="currentColor" />
      <circle cx="14" cy="10" r="1" fill="currentColor" />
    </svg>
  );
}

function UpdateIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 11-6.219-8.56" />
      <polyline points="21 3 21 9 15 9" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}
