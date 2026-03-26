import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
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

const HISTORY_DEFAULT_WIDTH_PX = Math.round(22 * 16 * 0.8);
const HISTORY_MIN_WIDTH_PX = 14 * 16;
// Once the split layout would shrink the chat below this width, we keep the
// chat fixed here and let the history pane start overlaying it instead.
const CHAT_MIN_WIDTH_PX = 24 * 16;
const HISTORY_OVERLAY_MARGIN_PX = 12;

export function App() {
  const [status, setStatus] = useState<ProcessStatus>(ProcessStatus.STOPPED);
  const [versionStatus, setVersionStatus] = useState<VersionStatusPayload | null>(null);
  const [contentWidth, setContentWidth] = useState<number | null>(null);
  const [historyWidth, setHistoryWidth] = useState(HISTORY_DEFAULT_WIDTH_PX);
  const historyWidthRef = useRef(HISTORY_DEFAULT_WIDTH_PX);
  const {
    activeSession,
    groupedSessions,
    activeSessionId,
    isPanelOpen,
    isLoading,
    isLoadingHistory,
    historyUnavailable,
    settings,
    togglePanel,
    closePanel,
    selectSession,
    createSession,
    refreshSessions,
    setSessionMode,
    setSessionModel,
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

  useEffect(() => {
    const updateWidth = () => {
      setContentWidth(document.documentElement.clientWidth);
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);

    return () => {
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  useEffect(() => {
    historyWidthRef.current = historyWidth;
  }, [historyWidth]);

  const effectiveHistoryWidth =
    contentWidth === null
      ? historyWidth
      : Math.min(
          historyWidth,
          Math.max(HISTORY_OVERLAY_MARGIN_PX, contentWidth - HISTORY_OVERLAY_MARGIN_PX)
        );

  const shouldUseHistoryOverlay =
    isPanelOpen &&
    contentWidth !== null &&
    contentWidth - effectiveHistoryWidth < CHAT_MIN_WIDTH_PX;
  const chatPaneStyle = shouldUseHistoryOverlay
    ? {
        width: `${CHAT_MIN_WIDTH_PX}px`,
        minWidth: `${CHAT_MIN_WIDTH_PX}px`,
        maxWidth: `${CHAT_MIN_WIDTH_PX}px`,
      }
    : { minWidth: '0px' };

  const handleHistoryResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = historyWidthRef.current;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + (startX - moveEvent.clientX);
      const maxWidthFromViewport =
        contentWidth === null
          ? nextWidth
          : Math.max(HISTORY_OVERLAY_MARGIN_PX, contentWidth - HISTORY_OVERLAY_MARGIN_PX);
      const clampedWidth = Math.min(
        maxWidthFromViewport,
        Math.max(HISTORY_MIN_WIDTH_PX, nextWidth)
      );
      setHistoryWidth(clampedWidth);
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

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

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div
          className={`flex flex-col overflow-hidden ${shouldUseHistoryOverlay ? 'shrink-0' : 'flex-1'}`}
          style={chatPaneStyle}
          onClick={shouldUseHistoryOverlay ? closePanel : undefined}
        >
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
          <ChatView
            className="flex-1"
            chat={chat}
            contextChips={contextChips}
            settings={settings}
            setSessionMode={setSessionMode}
            setSessionModel={setSessionModel}
          />
        </div>

        {isPanelOpen && (
          <div
            className={`${
              shouldUseHistoryOverlay
                ? 'absolute inset-y-0 right-0 z-20 shadow-[-10px_0_24px_rgba(0,0,0,0.28)]'
                : 'relative h-full shrink-0'
            } border-l border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)]`}
            style={{
              width: `${effectiveHistoryWidth}px`,
            }}
          >
            <div
              className="absolute inset-y-0 left-0 z-10 w-2 -translate-x-1/2 cursor-col-resize"
              onPointerDown={handleHistoryResizeStart}
              role="separator"
              aria-label="Resize history pane"
              aria-orientation="vertical"
            />
            <SessionList
              groupedSessions={groupedSessions}
              activeSessionId={activeSessionId}
              isLoading={isLoading}
              onSelectSession={selectSession}
              onClose={closePanel}
              onRefresh={refreshSessions}
            />
          </div>
        )}
      </div>
    </div>
  );
}
