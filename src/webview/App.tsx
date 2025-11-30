import { useEffect, useState } from 'react';
import { initializeBridge, onMessage } from './bridge';
import { ProcessStatus } from '../shared/types';
import { isStatusUpdateMessage } from '../shared/messages';
import { ChatContainer } from './components/chat/ChatContainer';

export function App() {
  const [status, setStatus] = useState<ProcessStatus>(ProcessStatus.STOPPED);

  useEffect(() => {
    initializeBridge();

    const unsubscribe = onMessage(message => {
      if (isStatusUpdateMessage(message)) {
        setStatus(message.payload.status);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const isConnected = status === ProcessStatus.RUNNING;

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

  return <ChatContainer className="h-screen" />;
}
