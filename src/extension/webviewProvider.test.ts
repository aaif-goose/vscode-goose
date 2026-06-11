import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import type * as vscode from 'vscode';
import {
  AnyWebviewMessage,
  createWebviewReadyMessage,
  WebviewMessageType,
} from '../shared/messages';
import { ProcessStatus } from '../shared/types';
import { Logger } from './logger';
import type { WebviewProvider } from './webviewProvider';

// The vscode package only exists inside the extension host, so it must be
// mocked before webviewProvider is (dynamically) imported. Only `Uri.joinPath`
// is used at runtime (inside getWebviewContent); everything else is types.
mock.module('vscode', () => ({
  Uri: {
    joinPath: (...parts: unknown[]) => ({ toString: () => parts.join('/') }),
  },
}));

let createWebviewProvider: typeof import('./webviewProvider')['createWebviewProvider'];

beforeAll(async () => {
  ({ createWebviewProvider } = await import('./webviewProvider'));
});

const noop = (): void => undefined;

const noopLogger: Logger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  child: () => noopLogger,
  setLevel: noop,
};

interface FakeWebviewView {
  readonly view: vscode.WebviewView;
  readonly posted: AnyWebviewMessage[];
  /** Simulate the webview sending its WEBVIEW_READY handshake */
  readonly signalReady: () => void;
}

function createFakeWebviewView(): FakeWebviewView {
  const posted: AnyWebviewMessage[] = [];
  let messageHandler: ((message: unknown) => void) | null = null;

  const view = {
    webview: {
      options: {},
      html: '',
      cspSource: 'vscode-resource:',
      asWebviewUri: (uri: unknown) => uri,
      postMessage: (message: AnyWebviewMessage): Promise<boolean> => {
        posted.push(message);
        return Promise.resolve(true);
      },
      onDidReceiveMessage: (handler: (message: unknown) => void) => {
        messageHandler = handler;
        return { dispose: noop };
      },
    },
    onDidDispose: (_handler: () => void) => ({ dispose: noop }),
  } as unknown as vscode.WebviewView;

  return {
    view,
    posted,
    signalReady: () => messageHandler?.(createWebviewReadyMessage('test')),
  };
}

function resolveView(provider: WebviewProvider): FakeWebviewView {
  const fake = createFakeWebviewView();
  provider.resolveWebviewView(
    fake.view,
    {} as vscode.WebviewViewResolveContext,
    {} as vscode.CancellationToken
  );
  return fake;
}

function messagesOfType(posted: AnyWebviewMessage[], type: WebviewMessageType) {
  return posted.filter(message => message.type === type);
}

describe('webviewProvider version status caching', () => {
  let provider: WebviewProvider;

  beforeEach(() => {
    provider = createWebviewProvider({
      extensionUri: { fsPath: '/ext' } as vscode.Uri,
      logger: noopLogger,
    });
  });

  test('compatible status clears blocked cache so reconnecting webview gets process status', () => {
    const first = resolveView(provider);
    first.signalReady();

    provider.updateVersionStatus({
      status: 'blocked_missing',
      minimumVersion: '1.16.0',
      installUrl: 'https://example.com/install',
    });

    // Recovery: bootstrap re-ran, version gate passed, subprocess is running.
    provider.updateVersionStatus({ status: 'compatible', minimumVersion: '1.16.0' });
    provider.updateStatus(ProcessStatus.RUNNING);

    // Webview reconnects (e.g. panel re-opened after recovery).
    const second = resolveView(provider);
    second.signalReady();

    const versionMessages = messagesOfType(second.posted, WebviewMessageType.VERSION_STATUS);
    const blocked = versionMessages.filter(
      message => (message.payload as { status: string }).status !== 'compatible'
    );
    expect(blocked).toHaveLength(0);

    const statusMessages = messagesOfType(second.posted, WebviewMessageType.STATUS_UPDATE);
    expect(statusMessages).toHaveLength(1);
    expect((statusMessages[0].payload as { status: ProcessStatus }).status).toBe(
      ProcessStatus.RUNNING
    );
  });

  test('still-blocked status is re-sent on reconnect with configuredPath intact', () => {
    const first = resolveView(provider);
    first.signalReady();

    provider.updateVersionStatus({
      status: 'blocked_missing',
      minimumVersion: '1.16.0',
      configuredPath: '/bad/path/goose',
    });

    const second = resolveView(provider);
    second.signalReady();

    const versionMessages = messagesOfType(second.posted, WebviewMessageType.VERSION_STATUS);
    expect(versionMessages).toHaveLength(1);
    expect(versionMessages[0].payload).toMatchObject({
      status: 'blocked_missing',
      configuredPath: '/bad/path/goose',
    });
  });

  test('compatible status is delivered to a live webview so it exits the blocked view', () => {
    const fake = resolveView(provider);
    fake.signalReady();

    provider.updateVersionStatus({
      status: 'blocked_missing',
      minimumVersion: '1.16.0',
    });
    provider.updateVersionStatus({ status: 'compatible', minimumVersion: '1.16.0' });

    const versionMessages = messagesOfType(fake.posted, WebviewMessageType.VERSION_STATUS);
    expect(versionMessages).toHaveLength(2);
    expect((versionMessages[1].payload as { status: string }).status).toBe('compatible');
  });
});
