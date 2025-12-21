import { describe, expect, test } from 'bun:test';
import {
  isSendMessageMessage,
  isStatusUpdateMessage,
  isVersionStatusMessage,
  isWebviewMessage,
  WebviewMessageType,
} from './messages';

describe('isWebviewMessage', () => {
  test('returns true for valid message with matching type', () => {
    const msg = { type: WebviewMessageType.STATUS_UPDATE, payload: { status: 'running' } };
    expect(isWebviewMessage(msg, WebviewMessageType.STATUS_UPDATE)).toBe(true);
  });

  test('returns false for message with different type', () => {
    const msg = { type: WebviewMessageType.GET_STATUS, payload: {} };
    expect(isWebviewMessage(msg, WebviewMessageType.STATUS_UPDATE)).toBe(false);
  });

  test('returns false for object missing type field', () => {
    const msg = { payload: { status: 'running' } };
    expect(isWebviewMessage(msg, WebviewMessageType.STATUS_UPDATE)).toBe(false);
  });

  test('returns false for null', () => {
    expect(isWebviewMessage(null, WebviewMessageType.STATUS_UPDATE)).toBe(false);
  });

  test('returns false for undefined', () => {
    expect(isWebviewMessage(undefined, WebviewMessageType.STATUS_UPDATE)).toBe(false);
  });

  test('returns false for non-object primitives', () => {
    expect(isWebviewMessage('string', WebviewMessageType.STATUS_UPDATE)).toBe(false);
    expect(isWebviewMessage(123, WebviewMessageType.STATUS_UPDATE)).toBe(false);
    expect(isWebviewMessage(true, WebviewMessageType.STATUS_UPDATE)).toBe(false);
  });

  test('returns false for array', () => {
    expect(isWebviewMessage([], WebviewMessageType.STATUS_UPDATE)).toBe(false);
    expect(
      isWebviewMessage(
        [{ type: WebviewMessageType.STATUS_UPDATE }],
        WebviewMessageType.STATUS_UPDATE
      )
    ).toBe(false);
  });
});

describe('isStatusUpdateMessage', () => {
  test('returns true for valid STATUS_UPDATE message', () => {
    const validMsg = { type: WebviewMessageType.STATUS_UPDATE, payload: { status: 'running' } };
    expect(isStatusUpdateMessage(validMsg)).toBe(true);
  });

  test('returns false for different message type', () => {
    const invalidMsg = { type: WebviewMessageType.GET_STATUS, payload: {} };
    expect(isStatusUpdateMessage(invalidMsg)).toBe(false);
  });

  test('returns false for null', () => {
    expect(isStatusUpdateMessage(null)).toBe(false);
  });
});

describe('isSendMessageMessage', () => {
  test('returns true for valid SEND_MESSAGE message', () => {
    const validMsg = {
      type: WebviewMessageType.SEND_MESSAGE,
      payload: { content: 'hello', messageId: '1', responseId: '2' },
    };
    expect(isSendMessageMessage(validMsg)).toBe(true);
  });

  test('returns false for different message type', () => {
    const invalidMsg = { type: WebviewMessageType.STATUS_UPDATE, payload: { status: 'running' } };
    expect(isSendMessageMessage(invalidMsg)).toBe(false);
  });

  test('returns false for undefined', () => {
    expect(isSendMessageMessage(undefined)).toBe(false);
  });
});

describe('isVersionStatusMessage', () => {
  test('returns true for valid VERSION_STATUS message', () => {
    const validMsg = {
      type: WebviewMessageType.VERSION_STATUS,
      payload: { status: 'compatible', minimumVersion: '1.16.0' },
    };
    expect(isVersionStatusMessage(validMsg)).toBe(true);
  });

  test('returns false for different message type', () => {
    const invalidMsg = {
      type: WebviewMessageType.ERROR,
      payload: { title: 'Error', message: 'oops' },
    };
    expect(isVersionStatusMessage(invalidMsg)).toBe(false);
  });

  test('returns false for malformed object', () => {
    expect(isVersionStatusMessage({ wrongField: 'value' })).toBe(false);
  });
});
