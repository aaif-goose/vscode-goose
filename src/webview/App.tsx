import { useEffect, useState } from 'react';
import {
  isStatusUpdateMessage,
  isVersionStatusMessage,
  VersionStatusPayload,
} from '../shared/messages';
import { ProcessStatus } from '../shared/types';
import { initializeBridge, onMessage } from './bridge';
import { ChatView } from './components/chat/ChatView';
import { SessionHeader, SessionList } from './components/session';
import { VersionBlockedView } from './components/VersionBlockedView';
import { useChat } from './hooks/useChat';
import { useContextChips } from './hooks/useContextChips';
import { useSession } from './hooks/useSession';

export function App() {
  const [status, setStatus] = useState<ProcessStatus>(ProcessStatus.STOPPED);
  const [versionStatus, setVersionStatus] = useState<VersionStatusPayload | null>(null);
  const {
    activeSession,
    groupedSessions,
    activeSessionId,
    isPanelOpen,
    isLoading,
    isLoadingHistory,
    historyUnavailable,
    togglePanel,
    closePanel,
    selectSession,
    createSession,
    refreshSessions,
  } = useSession();

  // Keep useChat at App level so message handlers are always registered
  const chat = useChat();

  // Keep useContextChips at App level so chip messages are received even before ChatView mounts
  const contextChips = useContextChips();

  useEffect(() => {
    initializeBridge();

    const unsubscribe = onMessage(message => {
      if (isStatusUpdateMessage(message)) {
        setStatus(message.payload.status);
      }
      if (isVersionStatusMessage(message)) {
        setVersionStatus(message.payload);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const isConnected = status === ProcessStatus.RUNNING;
  const isVersionBlocked =
    versionStatus?.status === 'blocked_missing' || versionStatus?.status === 'blocked_outdated';

  if (isVersionBlocked && versionStatus) {
    return (
      <VersionBlockedView
        status={versionStatus.status as 'blocked_missing' | 'blocked_outdated'}
        detectedVersion={versionStatus.detectedVersion}
        minimumVersion={versionStatus.minimumVersion}
        installUrl={versionStatus.installUrl}
        updateUrl={versionStatus.updateUrl}
      />
    );
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <div className="text-center">
          <p className="text-[var(--vscode-foreground)] mb-2">
            {status === ProcessStatus.STARTING
              ? 'Connecting to Goose...'
              : status === ProcessStatus.ERROR
                ? 'Connection error'
                : 'Waiting for Goose...'}
          </p>
          <p className="text-sm text-[var(--vscode-descriptionForeground)]">
            {status === ProcessStatus.ERROR
              ? 'Please check the Goose binary path in settings'
              : 'The Goose agent will start automatically'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <SessionHeader
        activeSession={activeSession}
        hasMessages={chat.messages.length > 0}
        onHistoryClick={togglePanel}
        onNewSessionClick={createSession}
      />

      {isPanelOpen ? (
        <SessionList
          groupedSessions={groupedSessions}
          activeSessionId={activeSessionId}
          isLoading={isLoading}
          onSelectSession={selectSession}
          onClose={closePanel}
          onRefresh={refreshSessions}
        />
      ) : (
        <>
          {isLoadingHistory && (
            <div className="px-4 py-2 text-sm text-[var(--vscode-descriptionForeground)] bg-[var(--vscode-editor-background)] border-b border-[var(--vscode-panel-border)]">
              Loading session history...
            </div>
          )}
          {historyUnavailable && (
            <div className="px-4 py-2 text-sm text-[var(--vscode-editorWarning-foreground)] bg-[var(--vscode-editor-background)] border-b border-[var(--vscode-panel-border)]">
              Session history is not available. Continue from where you left off.
            </div>
          )}
          <ChatView className="flex-1" chat={chat} contextChips={contextChips} />
        </>
      )}
    </div>
  );
}
