import { useEffect, useState } from 'react';
import { initializeBridge, onMessage } from './bridge';
import { ProcessStatus } from '../shared/types';
import { isStatusUpdateMessage } from '../shared/messages';

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

  const statusText = status === ProcessStatus.RUNNING ? '🟢 Connected' : '🔴 Disconnected';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl font-bold text-link mb-4">Hello Goose</h1>
      <p className="text-[var(--vscode-descriptionForeground)] mb-2">ACP Foundation Ready</p>
      <p className="text-sm">{statusText}</p>
    </div>
  );
}
