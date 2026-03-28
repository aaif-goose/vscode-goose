# Domain Concepts & Terminology

**Project**: VS Code Goose
**Domain**: AI Agent Communication, VS Code Extension Development, Session Management

## Core Business Concepts

### ProcessStatus
**Definition**: State machine enum for goose subprocess lifecycle: STOPPED → STARTING → RUNNING → ERROR. Tracks the current operational state of the external goose binary process.
**Implementation**: `src/shared/types.ts`
**Values**:
- `STOPPED`: Process not running
- `STARTING`: Process spawn initiated
- `RUNNING`: Process active and communicating
- `ERROR`: Process crashed or failed to start

### ChatMessage
**Definition**: Core data structure representing a single message in the chat conversation. Contains id, role (user/assistant/error), content, timestamp, status, optional context attachments, and optional structured assistant content parts.
**Implementation**: `src/shared/types.ts`
**Key Properties**:
- `id`: Unique identifier for message correlation
- `role`: MessageRole enum (USER, ASSISTANT, ERROR)
- `content`: Text content of the message
- `timestamp`: When the message was created (optional for history messages)
- `status`: MessageStatus tracking lifecycle state
- `originalContent`: For error messages, stores original message for retry
- `context`: Optional array of MessageContext for attached file references
- `contentParts`: Ordered assistant stream parts for text, thinking, and tool-call rendering

**Business Rules**:
- User messages are always status=COMPLETE
- Assistant messages transition: PENDING → STREAMING → COMPLETE/CANCELLED/ERROR
- Error messages may have originalContent to enable retry functionality

### ContextChip
**Definition**: UI element representing a file or code selection reference attached to a chat message. Displayed as removable pills in the input area.
**Implementation**: `src/shared/contextTypes.ts`, `src/webview/hooks/useContextChips.ts`
**Key Properties**:
- `id`: Unique identifier for the chip
- `filePath`: Absolute path to the referenced file
- `fileName`: Display name extracted from path
- `languageId`: VS Code language identifier for syntax highlighting
- `lineRange`: Optional line range (startLine, endLine) for code selections

**Business Rules**:
- Chips are displayed as removable pills in the input area
- Duplicate detection prevents same file/range being added twice
- Keyboard navigation (arrow keys, backspace) for accessibility

### MessageContext
**Definition**: Attached file reference within a ChatMessage. Contains filePath, fileName, optional line range, and optional content for history replay.
**Implementation**: `src/shared/types.ts`
**Relationships**:
- Converts from ContextChip when message is sent
- Contains `content` field for history messages (from ACP embedded resource)
- Absent content for live messages (extension reads on demand)

### FileSearchResult
**Definition**: Search result from @ file picker. Used for selecting files to attach as context.
**Implementation**: `src/shared/contextTypes.ts`
**Key Properties**:
- `path`: Absolute file path
- `fileName`: File name for display
- `relativePath`: Path relative to workspace root
- `languageId`: Language identifier for icon display
- `recentScore`: Timestamp-based ranking for recently accessed files

### ParsedFileReference
**Definition**: Extracted file reference from markdown content sent by Goose. Used for rendering file content blocks as collapsible cards.
**Implementation**: `src/shared/fileReferenceParser.ts`
**Key Properties**:
- `filePath`: Extracted absolute file path
- `fileName`: File name from path
- `content`: Optional file content from code block
- `language`: Language hint from code fence
- `lineRange`: Optional line range for selections

### SessionEntry
**Definition**: Stored session metadata containing sessionId, title, cwd (working directory), and createdAt timestamp. Represents a persisted conversation session that can be resumed.
**Implementation**: `src/shared/sessionTypes.ts`

### SessionSettingsState
**Definition**: Webview-facing representation of live ACP session settings for the active session. Currently includes optional mode and model selectors.
**Implementation**: `src/shared/sessionTypes.ts`
**Relationships**:
- Produced by `sessionManager.ts` from ACP `modes`, `models`, and `configOptions`
- Sent to the webview through the `SESSION_SETTINGS` message
- Rendered by `SessionSettingsBar` in the composer

### ChatContentPart
**Definition**: Structured assistant output unit rendered in order within a single assistant message.
**Implementation**: `src/shared/types.ts`
**Variants**:
- `text`: Standard assistant markdown/text output
- `thinking`: Hidden or supplemental reasoning text streamed separately from answer text
- `tool_call`: Tool lifecycle summary including status, preview content, and optional raw I/O

### ToolCallPart
**Definition**: Specialized `ChatContentPart` representing a tool execution shown in the assistant transcript.
**Implementation**: `src/shared/types.ts`
**Key Properties**:
- `id`: Tool call identifier from ACP
- `title`: Human-readable tool/action title
- `status`: `pending`, `in_progress`, `completed`, or `failed`
- `rawInput` / `rawOutput`: Raw structured payloads when provided
- `contentPreview`: Short extracted preview lines for quick scanning
- `locations`: Optional source file references connected to the tool call

### AgentCapabilities
**Definition**: Describes ACP agent capabilities received from initialize response. Tracks loadSession support and promptCapabilities (image, audio, embeddedContext).
**Implementation**: `src/shared/sessionTypes.ts`

### GooseError
**Definition**: Discriminated union of all possible domain errors with `_tag` field for exhaustive type narrowing.
**Implementation**: `src/shared/errors.ts`
**Variants**:
- `BinaryNotFoundError`: Goose binary not found in PATH or configured location
- `SubprocessSpawnError`: Failed to spawn subprocess
- `SubprocessCrashError`: Process exited unexpectedly
- `JsonRpcParseError`: Invalid JSON-RPC response
- `JsonRpcTimeoutError`: Request exceeded timeout
- `JsonRpcError`: Protocol-level error response
- `VersionMismatchError`: Installed version below minimum (1.16.0)

## Technical Concepts

### ACP Content Blocks
**Purpose**: Message content types in Agent Communication Protocol for file context
**Implementation**: `src/extension/sessionManager.ts`
**Types**:
- `text`: Plain text content
- `resource_link`: File reference by URI (lightweight, Goose reads file)
- `resource`: Embedded resource with content (for history replay)

### WebviewMessage Protocol
**Purpose**: Typed message passing between extension host and React webview
**Implementation**: `src/shared/messages.ts`
**Representative Message Families**:
- Core: WEBVIEW_READY, STATUS_UPDATE, GET_STATUS, ERROR
- Chat: SEND_MESSAGE, STREAM_TOKEN, THINKING_DELTA, TOOL_CALL_START, TOOL_CALL_UPDATE, GENERATION_COMPLETE, STOP_GENERATION, GENERATION_CANCELLED
- Session: CREATE_SESSION, SESSION_CREATED, GET_SESSIONS, SESSIONS_LIST, SELECT_SESSION, SESSION_LOADED
- History: CHAT_HISTORY, HISTORY_MESSAGE, HISTORY_COMPLETE
- Context: ADD_CONTEXT_CHIP, FILE_SEARCH, SEARCH_RESULTS, FOCUS_CHAT_INPUT
- Settings: SESSION_SETTINGS, SET_SESSION_MODE, SET_SESSION_MODEL
- Version: VERSION_STATUS
- Links: OPEN_EXTERNAL_LINK

### TaskEither Pattern
**Purpose**: fp-ts type for async operations that can fail with typed errors
**Usage**: All subprocess and session operations return TaskEither for composable error handling
**Pattern**:
```typescript
pipe(
  operation(),
  TE.map(result => transform(result)),
  TE.mapLeft(error => handleError(error))
)
```

## Terminology Glossary

### Business Terms
- **Goose**: The external AI agent binary that provides coding assistance
- **ACP**: Agent Communication Protocol - JSON-RPC interface for goose subprocess
- **Session**: A persistent conversation context with sessionId that can be resumed
- **Context Chip**: Visual pill representing attached file or code selection in chat input
- **@ Mention**: Typing @ at word boundary to activate file picker autocomplete
- **File Picker**: Dropdown for searching and selecting workspace files
- **Streaming Token**: Incremental text chunk from Goose during response generation
- **Thinking Chunk**: Incremental reasoning-style text streamed separately from the final assistant answer
- **Tool Call Card**: Collapsible UI block showing a tool execution and its details
- **Session Settings Bar**: Composer-area controls for mode/model selection
- **History Replay**: Loading and displaying past session messages when switching sessions

### Technical Terms
- **TaskEither**: fp-ts type for async operations that can fail with typed error
- **Discriminated Union**: TypeScript pattern using `_tag` or `type` field for type narrowing
- **Resource Link**: ACP content type for file references without embedded content
- **Embedded Context**: ACP capability for sending file content directly in messages
- **ndjson**: Newline-delimited JSON framing for stdin/stdout communication
- **Recent Score**: Timestamp ranking for file search results prioritization

## Cross-References
- **Architecture Patterns**: See [architecture.md#patterns]
- **Module Structure**: See [modules.md]
- **Implementation Patterns**: See [patterns.md]
