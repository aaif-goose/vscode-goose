# Implementation Patterns

**Project**: VS Code Goose
**Last Updated**: 2025-12-21

## Naming & Organization

**Files**: camelCase for source (versionChecker.ts, useFilePicker.ts, ChipStack.tsx)
**Functions**: camelCase with verb prefixes: create*, is* for guards, use* for hooks, parse*, handle*
**Imports**: Named imports, absolute from shared/, relative within same domain

Evidence: src/shared/messages.ts, src/webview/hooks/useFilePicker.ts

## Type & Data Modeling

**Data Representation**: TypeScript interfaces with readonly modifiers
**Type Strictness**: Strict typing with explicit return types, mapped types for payload inference
**Immutability**: Pervasive readonly on properties and arrays (readonly ContextChip[])
**Discriminated Unions**: `_tag` field for errors, `type` field for messages

Evidence: src/shared/errors.ts:66-74, src/shared/contextTypes.ts:1-28

## Error Handling

**Strategy**: fp-ts Either/TaskEither for typed async errors
**Propagation**: TaskEither returns E.left/E.right, formatError() for user messages
**Common Types**: BinaryNotFoundError, SubprocessSpawnError, JsonRpcError, VersionMismatchError

Evidence: src/shared/errors.ts, src/extension/versionChecker.ts:98-181

## Validation & Boundaries

**Location**: API boundary via type guard functions, message entry points
**Method**: Generic isWebviewMessage<T> with specializations, regex for content parsing
**Pattern**: Factory + Guard pairs (createStatusUpdateMessage / isStatusUpdateMessage)

Evidence: src/shared/messages.ts:538-548, src/shared/fileReferenceParser.ts:53-64

## Observability

**Logging**: Custom Logger abstraction with levels: debug, info, warn, error
**Tracing**: Session IDs and message IDs as correlation identifiers
**Metrics**: None detected

Evidence: src/extension/logger.ts, src/extension/webviewProvider.ts:52,123

## Testing Idioms

**Organization**: Co-located test files (*.test.ts)
**Framework**: Bun test runner
**Coverage**: Unit tests for pure functions (version parsing, file reference parsing)

Evidence: src/extension/versionChecker.test.ts, src/shared/fileReferenceParser.test.ts

## I/O & Integration

**Subprocess**: spawn with timeout cleanup pattern, JSON-RPC over ndjson-framed stdio
**State Persistence**: VS Code Memento API (globalState), webview getState/setState
**Graceful Shutdown**: SIGTERM then SIGKILL after timeout

Evidence: src/extension/subprocessManager.ts:86-102, src/extension/jsonRpcClient.ts:109-122

## Concurrency & Async

**Async Usage**: TaskEither for async operations, Promise-based waitForReady()
**Patterns**: Message queue with flush on ready, debounced search (100ms)
**Cleanup**: Returned unsubscribe functions for event handlers

Evidence: src/extension/webviewProvider.ts:147-154, src/webview/hooks/useFilePicker.ts:99-106

## UI Patterns

**State Management**: useReducer for complex UI state with typed action unions
**Keyboard Navigation**: handleKeyDown returns boolean to indicate consumed event
**Focus Management**: Arrow keys for chip navigation, focus restoration on removal
**Accessibility**: aria-live regions for announcements, role=list/listitem, sr-only class
**@ Trigger Detection**: Scan backwards from cursor for @ at word boundary

Evidence: src/webview/hooks/useChat.ts:25-36, src/webview/components/chat/ChipStack.tsx:34-99

## Communication Patterns

**Webview-Extension**: postMessage/onMessage with typed discriminated union messages
**Ready Sync**: Promise-based waitForReady() with callback accumulation
**Factory-Guards**: Paired createXMessage() factory and isXMessage() type guard
**State Resend**: Re-send lastStatus/lastVersionStatus on webview reconnect

Evidence: src/webview/bridge.ts:38-55, src/extension/webviewProvider.ts:105-120
