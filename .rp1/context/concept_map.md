---
scope: kbRoot
path_pattern: "concept_map.md"
producer: knowledge-base
type: document
description: "Domain concepts, terminology glossary, and cross-references for a single-project codebase."
strictness: strict
---
# Domain Concepts & Terminology

**Project**: vscode-goose
**Domain**: VS Code extension — thin UI bridge over ACP (Agent Communication Protocol) to the Goose AI agent subprocess

## Core Business Concepts

### ProcessStatus
**Definition**: State machine for the goose subprocess lifecycle: `STOPPED -> STARTING -> RUNNING -> ERROR`. Drives UI status indicators and gates operations.
**Implementation**: `src/shared/types.ts`

### ChatMessage
**Definition**: Single chat message. Fields: id, role, content, timestamp (optional for history), status, originalContent (for retry), context (attached file refs).
**Implementation**: `src/shared/types.ts`

### MessageRole / MessageStatus / LogLevel
**Definition**:
- `MessageRole`: `USER | ASSISTANT | ERROR` — ERROR marks a message whose delivery/generation failed.
- `MessageStatus`: `PENDING -> STREAMING -> COMPLETE | CANCELLED | ERROR`. User messages are always COMPLETE; assistant messages transition through streaming.
- `LogLevel`: numeric severity (`DEBUG=0, INFO=1, WARN=2, ERROR=3`) parsed from `goose.logLevel`.
**Implementation**: `src/shared/types.ts`

### ChatState
**Definition**: Webview UI bundle: `messages[]`, `isGenerating`, `currentResponseId`, `inputDraft`, `focusedMessageIndex`.
**Implementation**: `src/shared/types.ts`

### MessageContext / ContextChip
**Definition**:
- `MessageContext`: attached file reference inside a ChatMessage (`filePath`, `fileName`, optional `range`, optional `content` — content is present only when history is replayed via ACP embedded resource).
- `ContextChip`: input-area UI pill representing a file or code-range reference attached to the next prompt (`id`, `filePath`, `fileName`, `languageId`, optional `range`).
**Implementation**: `src/shared/contextTypes.ts`, `src/shared/types.ts`

### FileSearchResult
**Definition**: Result row from the @-picker file search (`path`, `fileName`, `relativePath`, `languageId`, `recentScore` — timestamp-based ranking).
**Implementation**: `src/shared/contextTypes.ts`

### ParsedFileReference / ParseResult
**Definition**: `ParsedFileReference` is a parsed file-reference block extracted from assistant markdown (H1 `# /path` or `File: /path:start-end` followed by a fenced code block). `ParseResult` is the discriminated union `{ type: 'file_reference', reference } | { type: 'text', content }` used to switch rendering between FileCard and Markdown.
**Implementation**: `src/shared/fileReferenceParser.ts`

### SessionEntry / SessionStorageData / GroupedSessions
**Definition**:
- `SessionEntry`: locally-persisted session metadata — `sessionId`, `title`, `cwd`, `createdAt`. Intentionally minimal; full transcript lives in goose.
- `SessionStorageData`: versioned wrapper — `schemaVersion: 1`, `activeSessionId`, `sessions[]`. Schema mismatch causes clean-slate reset (no migration), since goose is the source of truth.
- `GroupedSessions`: session list bucketed for UI as Today / Yesterday / `Month Day, Year`; sessions sort newest-first within a bucket.
**Implementation**: `src/shared/sessionTypes.ts`, `src/extension/sessionStorage.ts`

### AgentCapabilities
**Definition**: Capabilities reported by agent in ACP `initialize` response: `loadSession` (can replay history), `promptCapabilities.{image, audio, embeddedContext}`. `DEFAULT_CAPABILITIES` pre-enables loadSession for modern goose.
**Implementation**: `src/shared/sessionTypes.ts`

### GooseError
**Definition**: Closed discriminated union tagged via `_tag`: `BinaryNotFoundError | SubprocessSpawnError | SubprocessCrashError | JsonRpcParseError | JsonRpcTimeoutError | JsonRpcError | VersionMismatchError`. Every variant carries `message` + `timestamp` plus variant-specific fields.
**Implementation**: `src/shared/errors.ts`

### JsonRpcRequest / Response / Notification
**Definition**: JSON-RPC 2.0 wire types. Request has numeric `id` + `method` + `params`; Response returns `result` or `error`; Notification is id-less. All carry `jsonrpc: '2.0'`.
**Implementation**: `src/shared/types.ts`

### PendingRequest
**Definition**: In-flight JSON-RPC request record held in a `Map<id, entry>` inside `JsonRpcClient`: id, method, resolve, reject, timer. Timer enforces 30 s default timeout producing `JsonRpcTimeoutError`.
**Implementation**: `src/shared/types.ts`, `src/extension/jsonRpcClient.ts`

### BinaryDiscoveryConfig
**Definition**: Input bundle for binary discovery — `userConfiguredPath`, `platform`, `env`, `homeDir`. Decouples discovery logic from `process`/`os` globals for testability.
**Implementation**: `src/extension/binaryDiscovery.ts`

### VersionCheckResult
**Definition**: Output of version probe: `version` (parsed semver) + `isCompatible` (>= `1.16.0`).
**Implementation**: `src/extension/versionChecker.ts`

### WebviewMessage<T>
**Definition**: Generic discriminated `{ type: WebviewMessageType, payload: WebviewMessagePayloads[T] }`. ~24 message types split across Core / Chat / Session / History / Context / Version / Links. Each type has a `create*Message` factory and `is*Message` type guard.
**Implementation**: `src/shared/messages.ts`

### VersionStatusPayload.status
**Definition**: Tri-state gating signal: `blocked_missing | blocked_outdated | compatible`. Only `compatible` lets normal chat UI mount.
**Implementation**: `src/shared/messages.ts`

## Terminology Glossary

### Domain Terms
- **Goose**: external AI agent binary (>= 1.16.0) this extension drives as a subprocess.
- **ACP**: Agent Communication Protocol — JSON-RPC 2.0 vocabulary (`initialize`, `session/new`, `session/load`, `session/prompt` + `session/update`, `session/cancel`) spoken over stdin/stdout.
- **ndjson framing**: newline-delimited JSON — one JSON-RPC message per line, parsed by buffering stdout and splitting on `\n`.
- **Session**: persistent conversation identified by `sessionId`. Metadata persisted locally in `globalState`; transcript owned by goose and replayable via `session/load`.
- **Context Chip**: removable pill in the chat input representing an attached file or code range. Serialized to an ACP `resource_link` content block when the prompt is sent.
- **@ Mention**: typing `@` at a word boundary triggers the file-picker dropdown for adding Context Chips.
- **Streaming Token**: incremental text chunk delivered via `session/update` notifications (`sessionUpdate=agent_message_chunk`) and forwarded to the webview as `STREAM_TOKEN`.
- **History Replay**: loading a saved session — `session/load` triggers the agent to re-emit past messages as `session/update` notifications, which `SessionManager` converts into `HISTORY_MESSAGE` events.
- **Resource Link**: ACP content block `{ type: 'resource_link', uri, name, mimeType? }` — lightweight file reference; agent reads the file itself.
- **Embedded Resource**: ACP content block `{ type: 'resource', resource: { uri, text?, blob?, mimeType? } }` — carries file content inline; used for history replay when `embeddedContext` is on.
- **sessionUpdate kinds**: discriminator inside `session/update.params.update.sessionUpdate`. Handled values: `user_message_chunk`, `agent_message_chunk` (mapped to `MessageRole`).

### Technical Terms
- **TaskEither**: fp-ts `TaskEither<E, A>` — async operation resolving to `Either<E, A>`. Used for all subprocess, version, session, and JSON-RPC flows.
- **Discriminated Union**: TypeScript closed union narrowed by a literal tag — `_tag` for `GooseError`, `type` for ACP content blocks and `ParseResult`.
- **Recent Score**: timestamp-based ranking that sorts `FileSearchResult` so recently-touched files appear first in the @-picker.
- **File Reference Pattern**: two markdown shapes Goose emits to attach a file — H1 style (`# /abs/path` + fenced block) and File-prefix style (`File: /abs/path:start-end` + fenced block).
- **Version Gating**: at activation, the extension runs `goose --version`, parses semver, and refuses to initialize ACP unless `>= MINIMUM_VERSION` (1.16.0). Result is surfaced via `VERSION_STATUS`.
- **Thin UI Bridge**: architectural tenet from `AGENTS.md`/`ARCHITECTURE.md` — the extension owns no business logic, only orchestration between VS Code UI, webview, and goose.

## Relationships

- `ContextChip -> MessageContext` — chips attached at send-time are serialized into `MessageContext` entries on the outgoing `ChatMessage`.
- `ContextChip -> ACP resource_link` — on `session/prompt`, chips become `resource_link` content blocks (uri=`file://path`, optional range).
- `FileSearchResult -> ContextChip` — selecting a picker result creates a `ContextChip` for the input.
- `SessionManager -> JsonRpcClient` — SessionManager issues `session/new` and `session/load` via the shared JsonRpcClient and subscribes to its notifications.
- `SessionManager -> SessionStorage` — authoritative remote state is goose; SessionManager mirrors `SessionEntry` metadata into VS Code `globalState`.
- `SubprocessManager -> JsonRpcClient` — on successful spawn, SubprocessManager constructs a JsonRpcClient over the child's stdin/stdout.
- `JsonRpcClient -> GooseError` — request failures surface as `JsonRpcError`, `JsonRpcParseError`, or `JsonRpcTimeoutError`.
- `VersionChecker -> SubprocessManager` — version check must succeed before the ACP subprocess may start.
- `session/update -> HISTORY_MESSAGE / STREAM_TOKEN` — SessionManager demultiplexes `session/update` notifications into `HISTORY_MESSAGE` events (during load) or streaming-token events (during live prompt).
- `AgentCapabilities.loadSession -> History Replay` — if `loadSession` is false, SessionManager skips `session/load` and marks history unavailable on the `SESSION_LOADED` payload.

## Bounded Contexts

- **Shared Types (`src/shared/`)**: `ProcessStatus`, `ChatMessage`, `MessageContext`, `ContextChip`, `FileSearchResult`, `ParsedFileReference`, `SessionEntry`, `SessionStorageData`, `AgentCapabilities`, `GooseError`, JSON-RPC types, `WebviewMessage` protocol.
- **Extension Host — Node (`src/extension/`)**: `BinaryDiscovery`, `VersionChecker`, `SubprocessManager`, `JsonRpcClient`, `SessionManager`, `SessionStorage`, config reader (`goose.binaryPath`, `goose.logLevel`).
- **Webview — React (`src/webview/`)**: `ChatState`, Context Chips UI, `@` picker, history replay rendering, file-reference parsing for cards.
- **ACP Boundary (stdin/stdout of goose subprocess)**: `initialize`, `session/new`, `session/load`, `session/prompt`, `session/update`, `session/cancel`; ACP content blocks (`text | resource_link | resource`).

## Cross-Cutting Concerns

- **Error Handling**: all fallible paths return fp-ts `Either`/`TaskEither` of `GooseError` variants; no thrown errors escape module boundaries; `formatError` centralizes user-facing copy.
- **Logging**: shared `Logger` injected into every manager; log level from `goose.logLevel` via `parseLogLevel`; `JsonRpcClient` logs every Received/Notification line at `debug`.
- **Configuration**: read via `vscode.workspace.getConfiguration('goose')`. `goose.binaryPath` and `goose.logLevel` exposed; `onConfigChange` + `affectsSetting` for reactive updates.
- **Lifecycle / Disposal**: every manager exposes `dispose()` that clears callbacks, timers, and pending requests; SubprocessManager performs graceful SIGTERM with 5 s timeout before SIGKILL.
- **Capability Negotiation**: `AgentCapabilities` captured from `initialize` response; `hasLoadSessionCapability` / `hasEmbeddedContextCapability` gate optional requests.
- **Identity Generation**: local ids use `${Date.now()}-${random36}` pattern for ChatMessage ids and similar ephemeral identifiers; session ids come from goose via `session/new`.
- **Timeouts**: JSON-RPC requests default to 30 s (`DEFAULT_TIMEOUT_MS`) producing `JsonRpcTimeoutError`; version probe uses 5 s; subprocess graceful shutdown uses 5 s before SIGKILL.

## Cross-References

- **Architecture & data flows**: See [architecture.md](architecture.md)
- **Cross-surface behavior**: See [interaction-model.md](interaction-model.md)
- **Module inventory**: See [modules.md](modules.md)
- **Implementation patterns**: See [patterns.md](patterns.md)
