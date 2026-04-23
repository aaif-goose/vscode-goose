---
scope: kbRoot
path_pattern: "modules.md"
producer: knowledge-base
type: document
description: "Module and component breakdown with dependency graphs, metrics, and code quality insights for a single-project codebase."
strictness: strict
---
# Module & Component Breakdown

**Project**: vscode-goose
**Analysis Date**: 2026-04-23
**Modules Analyzed**: 10

## Core Modules

### `src/extension/`
**Purpose**: VS Code extension host — lifecycle, subprocess, ACP session, version checking, file search, webview hosting.
**Complexity**: Medium–High
**File count**: 12 non-test .ts
**Key files**: `extension.ts`, `subprocessManager.ts`, `jsonRpcClient.ts`, `sessionManager.ts`, `webviewProvider.ts`, `commands.ts`, `versionChecker.ts`, `fileSearchService.ts`, `binaryDiscovery.ts`, `sessionStorage.ts`, `config.ts`, `logger.ts`.
**Testing**: colocated `*.test.ts` (binaryDiscovery, sessionStorage, versionChecker, jsonRpcClient) + `subprocess.integration.test.ts`.

### `src/shared/`
**Purpose**: Cross-boundary type contracts and small utilities compiled into both bundles.
**Complexity**: Low
**File count**: 7 non-test .ts
**Key files**: `messages.ts`, `types.ts`, `contextTypes.ts`, `sessionTypes.ts`, `errors.ts`, `fileReferenceParser.ts`, `index.ts`.
**Testing**: `types.test.ts`, `messages.test.ts`, `errors.test.ts`, `fileReferenceParser.test.ts`.

### `src/webview/`
**Purpose**: React 19 chat UI rendered inside sandboxed VS Code webview iframe.
**Key files**: `App.tsx`, `index.tsx`, `bridge.ts`, `theme.ts`; `styles.css` (Tailwind 4 build output).

### `src/webview/hooks/`
**Purpose**: State management hooks for chat, session, context chips, file picker, autoscroll, keyboard nav.
**Key files**: `useChat.ts`, `useSession.ts`, `useContextChips.ts`, `useFilePicker.ts`, `useAutoScroll.ts`, `useKeyboardNav.ts`.

### `src/webview/components/chat/`
**Purpose**: Chat UI primitives (container, view, message list/items, input area, chips, buttons, progress, errors).
**Key files**: `ChatContainer.tsx`, `ChatView.tsx`, `MessageList.tsx`, `MessageItem.tsx`, `InputArea.tsx`, `ChipStack.tsx`, `ContextChip.tsx`, `AssistantMessage.tsx`, `UserMessage.tsx`, `FileReferenceCard.tsx`, `SendButton.tsx`, `StopButton.tsx`, `ProgressIndicator.tsx`, `ErrorMessage.tsx`, `index.ts`.

### `src/webview/components/picker/`
**Purpose**: `@`-mention file picker dropdown.
**Key files**: `FilePicker.tsx`, `FilePickerItem.tsx`, `index.ts`.

### `src/webview/components/session/`
**Purpose**: Session management UI — header, list, per-session card.
**Key files**: `SessionHeader.tsx`, `SessionList.tsx`, `SessionCard.tsx`, `index.ts`.

### `src/webview/components/markdown/`
**Purpose**: Markdown rendering with code blocks + copy affordance.
**Key files**: `MarkdownRenderer.tsx`, `CodeBlock.tsx`, `CopyButton.tsx`.

### `src/webview/components/icons/`
**Purpose**: Icon assets — file-type glyph and Goose watermark.
**Key files**: `FileTypeIcon.tsx`, `GooseWatermark.tsx`.

### `src/test/mocks/`
**Purpose**: Shared test doubles for the `vscode` API and ndjson streams used across unit + integration tests.
**Key files**: `vscode.ts`, `streams.ts`, `mocks.test.ts`.

## Key Components

| Component | File | Role | Primary responsibilities |
|-----------|------|------|--------------------------|
| Extension Entry | `src/extension/extension.ts` | entrypoint | activate()/deactivate(); wire services; version gate; register commands + webview |
| SubprocessManager | `src/extension/subprocessManager.ts` | service | spawn goose; expose JsonRpcClient; emit exit/error; graceful SIGTERM→SIGKILL |
| JsonRpcClient | `src/extension/jsonRpcClient.ts` | service | JSON-RPC 2.0 over stdio (ndjson); timeouts; pending-request map |
| SessionManager | `src/extension/sessionManager.ts` | service | `session/new`/`session/load`; active session + capabilities; TaskEither API |
| SessionStorage | `src/extension/sessionStorage.ts` | repository | VS Code `globalState` CRUD over `SessionEntry[]`; schemaVersion handling |
| WebviewProvider | `src/extension/webviewProvider.ts` | controller | `WebviewViewProvider`; CSP nonce HTML; ready-sync queue; status broadcast |
| Commands | `src/extension/commands.ts` | controller | `goose.showLogs`, `goose.restart`, `goose.sendSelectionToChat` |
| VersionChecker | `src/extension/versionChecker.ts` | service | invoke `goose --version`; parse semver; gate ≥ 1.16.0 |
| FileSearchService | `src/extension/fileSearchService.ts` | service | ranked `workspace.findFiles` for `@` picker |
| BinaryDiscovery | `src/extension/binaryDiscovery.ts` | utility | cross-platform goose binary resolution (config override → PATH → known paths) |
| Config | `src/extension/config.ts` | utility | typed reader for `goose.*` |
| Logger | `src/extension/logger.ts` | utility | source-tagged logger over VS Code OutputChannel |
| Messages | `src/shared/messages.ts` | contract | `WebviewMessage` union + factories + guards (~24 types) |
| Shared Types | `src/shared/types.ts` | contract | ProcessStatus, ChatMessage, MessageRole, MessageContext |
| ContextTypes | `src/shared/contextTypes.ts` | contract | ContextChip, FileSearchResult, LineRange |
| SessionTypes | `src/shared/sessionTypes.ts` | contract | SessionEntry, AgentCapabilities, `groupSessionsByDate` |
| Errors | `src/shared/errors.ts` | contract | `GooseError` discriminated union + factories |
| FileReferenceParser | `src/shared/fileReferenceParser.ts` | utility | parse file references from assistant markdown |
| App | `src/webview/App.tsx` | component | root webview; composes hooks; gates UI on version + ProcessStatus |
| Bridge | `src/webview/bridge.ts` | utility | typed `postMessage` abstraction over VS Code webview API |
| useChat / useSession / useContextChips / useFilePicker / useKeyboardNav / useAutoScroll | `src/webview/hooks/*` | hooks | UI state, bridge wiring, keyboard/autoscroll behavior |
| ChatContainer / InputArea / MarkdownRenderer / FilePicker / SessionList / VersionBlockedView | `src/webview/components/**` | components | layout shell, composer, rendering, pickers, session UI, version-blocked screen |

## Module Dependencies

```mermaid
graph TD
    ExtEntry[extension.ts] --> Sub[subprocessManager]
    ExtEntry --> Ver[versionChecker]
    ExtEntry --> Disc[binaryDiscovery]
    ExtEntry --> Sess[sessionManager]
    ExtEntry --> WvP[webviewProvider]
    ExtEntry --> Cmd[commands]
    Sub --> Rpc[jsonRpcClient]
    Sess --> Rpc
    Sess --> Store[sessionStorage]
    WvP --> SharedMsgs[shared/messages]
    Cmd --> WvP
    Cmd --> Sub
    App[webview/App] --> Hooks[webview/hooks]
    App --> Bridge[webview/bridge]
    Bridge --> SharedMsgs
    InputArea[components/chat/InputArea] --> useFilePicker
    MarkdownRenderer[components/markdown/MarkdownRenderer] --> SharedParser[shared/fileReferenceParser]
    SharedMsgs --> SharedTypes[shared/{types,contextTypes,sessionTypes,errors}]
```

### Import Analysis
- **Most imported (fan-in)**: `src/shared/messages.ts` (extension + webview consumers).
- **Most dependencies (fan-out)**: `src/extension/extension.ts` (wires every host-side service).
- **Circular dependencies**: none detected.

## Module Metrics

| Module | Files | Components | Internal deps | External deps |
|--------|-------|------------|---------------|---------------|
| `src/extension` | 12 | 12 | 11 | 2 (`vscode`, `fp-ts`) |
| `src/shared` | 7 | 7 | 4 | 0 |
| `src/webview` | 4 (+ `styles.css`) | 4 | 6 | 2 (`react`, `react-dom`) |
| `src/webview/hooks` | 6 | 6 | 4 | 1 (`react`) |
| `src/webview/components/chat` | 15 | 14 | 9 | 1 (`react`) |
| `src/webview/components/picker` | 3 | 2 | 2 | 1 |
| `src/webview/components/session` | 4 | 3 | 2 | 1 |
| `src/webview/components/markdown` | 3 | 3 | 2 | 2 (`react-markdown`, `react-syntax-highlighter`) |
| `src/webview/components/icons` | 2 | 2 | 0 | 1 |
| `src/test/mocks` | 3 | — | — | — |

### External Dependencies (runtime)
- `vscode` `^1.95.0` — VS Code extension API
- `react` / `react-dom` `^19.1.0` — UI
- `react-markdown` `^10.1.0`
- `react-syntax-highlighter` `^15.6.1`
- `fp-ts` `^2.16.0` — TaskEither-based error handling
- `@tailwindcss/cli` `^4.1.0` — Tailwind v4 build
- `@vscode/vsce` — packaging (devDependency)

## Module Boundaries

- **`src/extension`** — public API exposed via `package.json` contributions (commands, view, settings, keybinding); internal services are implementation detail.
- **`src/shared`** — pure type + factory module; must stay free of VS Code and DOM APIs.
- **`src/webview`** — communicates with host exclusively through `Bridge` + `shared/messages`.

## Cross-Module Patterns

- **Bridge + Typed Messages** — single discriminated union in `shared/messages.ts` with factories and guards on both sides. Involved: `extension/webviewProvider`, `webview/bridge`, `shared/messages`.
- **Ready-Sync Message Queue** — `WebviewProvider` buffers host→webview messages until ready. Involved: `extension/webviewProvider`, `webview/App`.
- **TaskEither Error Channel** — extension-side services return `TaskEither<GooseError, T>`. Involved: `extension/sessionManager`, `extension/versionChecker`, `shared/errors`.
- **Context Chip Flow** — editor selection → commands → shared messages → `useContextChips` → `ChipStack` → sent with message as `resource_link`. Involved: `extension/commands`, `shared/messages`, `webview/hooks/useContextChips`, `webview/components/chat/ChipStack`.
- **File Picker Request/Response** — webview `@` trigger → `FILE_SEARCH_REQUEST` → `fileSearchService` → `FILE_SEARCH_RESULT` → `FilePicker`. Involved: `useFilePicker`, `shared/messages`, `extension/fileSearchService`, `components/picker/FilePicker`.
- **Version Gating** — `versionChecker` result broadcast as `VERSION_STATUS`; webview swaps chat UI for `VersionBlockedView` when unsupported.
- **Shared Test Mocks** — `src/test/mocks` centralizes `vscode` API and ndjson stream doubles across unit and integration tests.

## Code Quality Insights

### Well-Structured Modules
- **`src/shared`** — pure, framework-free contracts with exhaustive factories + guards per message variant.
- **`src/extension`** — single-responsibility services with consistent TaskEither error channel.
- **`src/webview/hooks`** — hooks composed as reducers with typed action unions; leaf state lives close to consumers.

### Architectural Patterns (applied across modules)
- **Typed discriminated unions** at every cross-boundary surface.
- **Ready-sync handshake** for webview mount race conditions.
- **Capability negotiation** (from ACP `initialize`) gating optional requests in `SessionManager`.
- **Version-gated activation** before any ACP interaction.
