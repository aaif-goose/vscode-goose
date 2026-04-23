---
scope: kbRoot
path_pattern: "patterns.md"
producer: knowledge-base
type: document
description: "Implementation patterns, coding conventions, and idioms for a single-project codebase. Hard limit of 150 lines."
strictness: strict
---
# Implementation Patterns

**Project**: vscode-goose
**Last Updated**: 2026-04-23

## Project Principles

**Design Intent**: Thin UI bridge between VS Code and Goose via ACP — nothing else. No bloat.
**Aesthetic**: Goose Desktop look & feel as baseline for UI decisions.
**Style**: Functional programming preferred (fp-ts `Either`/`TaskEither`, readonly data, hooks + pure functions).
**Library Selection**: Lean, well-supported, latest stable versions when adding dependencies.

Evidence: `AGENTS.md:3-12`, `src/shared/errors.ts`, `src/webview/hooks/useChat.ts`

## Naming & Organization

**Files**: camelCase for source (`versionChecker.ts`, `useFilePicker.ts`); `PascalCase.tsx` for components (`ChipStack.tsx`, `MessageList.tsx`).
**Functions**: camelCase with verb prefixes — `create*`, `is*` for guards, `use*` for hooks, `parse*`, `handle*`.
**Imports**: named imports; absolute from `shared/`, relative within same domain; `organizeImports` assist on (`biome.json:335-337`).
**Layout**: three-layer split — `src/extension` (Node host), `src/webview` (React iframe), `src/shared` (cross-boundary types).

Evidence: `src/shared/messages.ts`, `src/webview/hooks/useFilePicker.ts`, `biome.json:335-337`

## Type & Data Modeling

**Data Representation**: TypeScript interfaces with pervasive `readonly`.
**Type Strictness**: strict with explicit return types; mapped types for payload inference; `noExplicitAny=warn`, `noNonNullAssertion=warn` on extension/shared (`biome.json:178-183`).
**Immutability**: `readonly` properties and `readonly T[]` by default; `useAsConstAssertion` enforced.
**Discriminated Unions**: `_tag` for errors, `type` for messages and ACP content blocks.

Evidence: `src/shared/errors.ts:66-74`, `src/shared/contextTypes.ts:1-28`, `biome.json:69,178-183`

## Error Handling

**Strategy**: fp-ts `Either` / `TaskEither` for typed async errors; no throw-at-boundary.
**Propagation**: `TaskEither` returns `E.left`/`E.right`; `formatError()` centralises user-facing strings.
**Common Types**: `BinaryNotFoundError`, `SubprocessSpawnError`, `JsonRpcError`, `VersionMismatchError` (tagged union under `GooseError`).

Evidence: `src/shared/errors.ts`, `src/extension/versionChecker.ts:98-181`

## Validation & Boundaries

**Location**: boundary-checked via type-guard functions at message entry points (webview ↔ extension, stdio ↔ client).
**Method**: generic `isWebviewMessage<T>` with specialised guards; regex for file-reference / `@`-trigger parsing.
**Pattern**: Factory + Guard pairs — `createStatusUpdateMessage` paired with `isStatusUpdateMessage`.

Evidence: `src/shared/messages.ts:538-548`, `src/shared/fileReferenceParser.ts:53-64`

## Observability

**Logging**: custom `Logger` abstraction with `debug`/`info`/`warn`/`error` levels.
**Tracing**: session ids and message ids as correlation identifiers across extension/webview.
**Metrics**: none detected.

Evidence: `src/extension/logger.ts`, `src/extension/webviewProvider.ts:52,123`

## Testing Idioms

**Organization**: co-located test files (`*.test.ts` next to source).
**Framework**: Bun test runner (preferred per `AGENTS.md`).
**Coverage**: unit tests for pure functions (version parsing, file-reference parsing); `subprocess.integration.test.ts` exercises the subprocess + RPC path.
**Mocks**: shared in `src/test/mocks` (`vscode.ts`, `streams.ts`).

Evidence: `src/extension/versionChecker.test.ts`, `src/shared/fileReferenceParser.test.ts`, `src/test/mocks/*`

## I/O & Integration

**Subprocess**: `spawn` with timeout-cleanup pattern; JSON-RPC over ndjson-framed stdio.
**Binary Discovery**: path resolution + version gate (≥ 1.16.0) before session start.
**State Persistence**: VS Code Memento API (`globalState`) for sessions; webview `getState`/`setState` for UI state.
**Graceful Shutdown**: SIGTERM then SIGKILL after 5 s timeout.

Evidence: `src/extension/subprocessManager.ts:86-102`, `src/extension/jsonRpcClient.ts:109-122`, `src/extension/binaryDiscovery.ts`

## Concurrency & Async

**Async Usage**: `TaskEither` for typed async; Promise-based `waitForReady()` for webview handshake.
**Patterns**: message queue with flush-on-ready; debounced search (~100 ms).
**Cleanup**: subscribe functions return unsubscribe; `useEffect` teardown for event handlers.

Evidence: `src/extension/webviewProvider.ts:147-154`, `src/webview/hooks/useFilePicker.ts:99-106`

## UI Patterns

**State Management**: `useReducer` for complex UI state with typed action unions; local `useState` for leaf concerns.
**Hooks Discipline**: `useHookAtTopLevel=error`, `useExhaustiveDependencies=warn`, `useJsxKeyInIterable=error` (`biome.json:317-322`).
**Keyboard Navigation**: `handleKeyDown` returns boolean to indicate consumed event.
**Focus Management**: arrow keys for chip navigation; focus restoration on removal.
**Accessibility**: `aria-live` regions for announcements; `role=list/listitem`; `sr-only` class; nonce+CSP webview.
**@ Trigger Detection**: scan backwards from cursor for `@` at word boundary.
**Styling**: Tailwind v4 utility classes + VS Code theme tokens via `src/webview/theme.ts`.

Evidence: `src/webview/hooks/useChat.ts:25-36`, `src/webview/components/chat/InputArea.tsx`, `src/webview/theme.ts`, `biome.json:317-331`

## Communication Patterns

**Webview ↔ Extension**: `postMessage`/`onMessage` with typed discriminated-union messages.
**Ready Sync**: Promise-based `waitForReady()` with callback accumulation.
**Factory–Guard Pair**: paired `createXMessage()` + `isXMessage()` per message type.
**State Resend**: resend last `status` / `versionStatus` on webview reconnect.

Evidence: `src/webview/bridge.ts:38-55`, `src/extension/webviewProvider.ts:105-120`

## Tooling & Code Style

**Runtime / Package Manager**: Bun preferred (per `AGENTS.md`); `bun.lock` checked in.
**Linter / Formatter**: Biome 2.x — 2-space indent, 100-col width, single quotes, double JSX quotes, es5 trailing commas, semicolons always (`biome.json:5-27,109-122`).
**Module System**: ESM only — `noCommonJs=error`, `noNamespace=error` (`biome.json:65-70`).
**TS Safety**: `noVar=error`, `useConst=error`, `useAsConstAssertion=error` in TS override (`biome.json:157-169`).
**Formatting Scope**: `package.json` excluded from formatter (`biome.json:25`).
**CI / Release**: Conventional Commits enforced by commitlint + Husky; release-please automates SemVer + Release PRs; `vsce package --no-dependencies` builds VSIX from bundled `dist/`.

Evidence: `biome.json:5-27,65-70,109-122,157-169`, `AGENTS.md:9-11`, `.husky/*`, `commitlint.config.js`, `release-please-config.json`
