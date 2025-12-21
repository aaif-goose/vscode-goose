/**
 * Bridge module for webview-extension communication via postMessage.
 */

import {
  AnyWebviewMessage,
  createWebviewReadyMessage,
  WebviewMessageType,
} from '../shared/messages';

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
  }
}

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

const EXTENSION_VERSION = '2.0.0';

let vscodeApi: VsCodeApi | null = null;

function getVsCodeApi(): VsCodeApi {
  if (!vscodeApi) {
    if (typeof window.acquireVsCodeApi === 'function') {
      vscodeApi = window.acquireVsCodeApi();
    } else {
      throw new Error('VS Code API not available');
    }
  }
  return vscodeApi;
}

export function postMessage(message: AnyWebviewMessage): void {
  const api = getVsCodeApi();
  api.postMessage(message);
}

export type MessageHandler = (message: AnyWebviewMessage) => void;

const messageHandlers: MessageHandler[] = [];

export function onMessage(handler: MessageHandler): () => void {
  messageHandlers.push(handler);
  return () => {
    const index = messageHandlers.indexOf(handler);
    if (index > -1) {
      messageHandlers.splice(index, 1);
    }
  };
}

function handleIncomingMessage(event: MessageEvent): void {
  const message = event.data as AnyWebviewMessage;
  for (const handler of messageHandlers) {
    try {
      handler(message);
    } catch (err) {
      console.error('Message handler error:', err);
    }
  }
}

export function initializeBridge(): void {
  window.addEventListener('message', handleIncomingMessage);
  postMessage(createWebviewReadyMessage(EXTENSION_VERSION));
}

export function getState<T>(): T | undefined {
  try {
    const api = getVsCodeApi();
    return api.getState() as T | undefined;
  } catch {
    return undefined;
  }
}

export function setState<T>(state: T): void {
  try {
    const api = getVsCodeApi();
    api.setState(state);
  } catch {
    console.warn('Failed to set state');
  }
}

export { WebviewMessageType };
