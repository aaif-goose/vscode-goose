import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
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
const HISTORY_ANIMATION_DURATION_MS = 250;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function App() {
  const [status, setStatus] = useState<ProcessStatus>(ProcessStatus.STOPPED);
  const [versionStatus, setVersionStatus] = useState<VersionStatusPayload | null>(null);
  const [contentWidth, setContentWidth] = useState<number | null>(null);
  const [historyWidth, setHistoryWidth] = useState(HISTORY_DEFAULT_WIDTH_PX);
  const [historyOpenProgress, setHistoryOpenProgress] = useState(0);
  const historyWidthRef = useRef(HISTORY_DEFAULT_WIDTH_PX);
  const historyOpenProgressRef = useRef(0);
  const historyAnimationFrameRef = useRef<number | null>(null);
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

  useEffect(() => {
    historyOpenProgressRef.current = historyOpenProgress;
  }, [historyOpenProgress]);

  const effectiveHistoryWidth =
    contentWidth === null
      ? historyWidth
      : Math.min(
          historyWidth,
          Math.max(HISTORY_OVERLAY_MARGIN_PX, contentWidth - HISTORY_OVERLAY_MARGIN_PX)
        );

  useEffect(() => {
    if (historyAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(historyAnimationFrameRef.current);
      historyAnimationFrameRef.current = null;
    }

    const startProgress = historyOpenProgressRef.current;
    const targetProgress = isPanelOpen ? 1 : 0;

    if (Math.abs(startProgress - targetProgress) < 0.001) {
      setHistoryOpenProgress(targetProgress);
      return;
    }

    let startTime: number | null = null;

    const step = (timestamp: number) => {
      if (startTime === null) {
        startTime = timestamp;
      }

      const elapsed = timestamp - startTime;
      const t = Math.min(1, elapsed / HISTORY_ANIMATION_DURATION_MS);
      const easedT = easeOutCubic(t);
      const nextProgress = startProgress + (targetProgress - startProgress) * easedT;

      setHistoryOpenProgress(nextProgress);

      if (t < 1) {
        historyAnimationFrameRef.current = window.requestAnimationFrame(step);
      } else {
        historyAnimationFrameRef.current = null;
      }
    };

    historyAnimationFrameRef.current = window.requestAnimationFrame(step);

    return () => {
      if (historyAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(historyAnimationFrameRef.current);
        historyAnimationFrameRef.current = null;
      }
    };
  }, [isPanelOpen]);

  useEffect(() => {
    return () => {
      if (historyAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(historyAnimationFrameRef.current);
      }
    };
  }, []);

  const isHistoryRendered = isPanelOpen || historyOpenProgress > 0.001;
  const visibleHistoryWidth = effectiveHistoryWidth * historyOpenProgress;
  const historyLeftEdge =
    contentWidth === null ? null : Math.max(0, contentWidth - visibleHistoryWidth);
  const chatWidth =
    historyLeftEdge === null || contentWidth === null
      ? null
      : Math.min(contentWidth, Math.max(CHAT_MIN_WIDTH_PX, historyLeftEdge));
  const isHistoryOverlayingChat = historyLeftEdge !== null && historyLeftEdge < CHAT_MIN_WIDTH_PX;
  const chatPaneStyle =
    chatWidth === null
      ? { minWidth: '0px' }
      : {
          width: `${chatWidth}px`,
          minWidth: `${chatWidth}px`,
          maxWidth: `${chatWidth}px`,
        };

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
          className={`flex shrink-0 flex-col overflow-hidden`}
          style={chatPaneStyle}
          onClick={isHistoryOverlayingChat ? closePanel : undefined}
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
            activeSessionId={activeSessionId}
            settings={settings}
            setSessionMode={setSessionMode}
            setSessionModel={setSessionModel}
          />
        </div>

        {isHistoryRendered && (
          <div
            className={`absolute inset-y-0 right-0 z-20 border-l border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] shadow-[-10px_0_24px_rgba(0,0,0,0.28)]`}
            style={{
              width: `${effectiveHistoryWidth}px`,
              transform: `translateX(${(1 - historyOpenProgress) * 100}%)`,
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
