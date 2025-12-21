# System Architecture

**Project**: VS Code Goose
**Architecture Pattern**: Bridge/Adapter with Message-Driven Communication
**Last Updated**: 2025-12-21

## High-Level Architecture

```mermaid
graph TB
    subgraph VSCode["VS Code"]
        UI["VS Code UI<br/>(Commands, Activity Bar)"]
        ExtHost["Extension Host<br/>(Node.js)"]
        Webview["Chat Webview<br/>(React/iframe)"]
    end

    subgraph Extension["Extension Host Components"]
        ExtMain["extension.ts<br/>(Main Entry)"]
        SubMgr["SubprocessManager<br/>(Process Lifecycle)"]
        JsonRpc["JsonRpcClient<br/>(ACP Protocol)"]
        SessMgr["SessionManager<br/>(Session State)"]
        WebProv["WebviewProvider<br/>(UI Bridge)"]
        VC["VersionChecker"]
        FSS["FileSearchService"]
    end

    subgraph External["External"]
        goose["goose Process<br/>(AI Daemon)"]
        GS["globalState"]
    end

    UI -->|commands| ExtMain
    ExtMain --> SubMgr
    ExtMain --> SessMgr
    ExtMain --> WebProv
    SubMgr -->|spawn/stdin/stdout| goose
    SubMgr --> JsonRpc
    JsonRpc -->|JSON-RPC 2.0| goose
    goose -->|stream notifications| JsonRpc
    WebProv <-->|postMessage| Webview
    SessMgr --> JsonRpc
    SessMgr -->|persist| GS
    VC -->|goose --version| goose
    FSS -->|workspace.findFiles| UI
```

## Architectural Patterns

### Bridge/Adapter Architecture

The extension is deliberately minimal - a thin UI layer connecting VS Code webview to Goose backend via Agent Communication Protocol (ACP). No business logic in the extension itself.

### Layered Architecture

Four distinct layers with unidirectional dependencies:

1. **Webview** (presentation) - React components
2. **Extension** (orchestration) - VS Code integration
3. **ACP Client** (protocol) - JSON-RPC handling
4. **Goose subprocess** - External process communication

### Message-Driven Communication

All communication between webview and extension uses a strongly-typed message passing system with 24 message types, factory functions, and type guards.

### Gated Activation

Multi-stage activation gate: binary discovery → version validation → subprocess spawn. Each stage can block activation with appropriate user messaging.

## Component Architecture

### Extension Host Layer

**Location**: `src/extension/`
**Components**:

- `extension.ts` - Orchestrates activation, ACP session init, wires components
- `sessionManager.ts` - Session lifecycle, history replay, ACP coordination
- `webviewProvider.ts` - Webview lifecycle, message queue, ready sync
- `subprocessManager.ts` - Spawns goose binary, manages lifecycle events
- `jsonRpcClient.ts` - JSON-RPC 2.0 client with ndjson framing
- `versionChecker.ts` - Binary version validation (>= 1.16.0)
- `fileSearchService.ts` - Workspace file discovery for @ picker
- `commands.ts` - VS Code command registration (showLogs, restart, sendSelectionToChat)

### Webview Layer

**Location**: `src/webview/`
**Components**:

- `App.tsx` - Root component with status, session and chat state
- `bridge.ts` - postMessage abstraction for extension communication
- `ChatView.tsx` - Chat container with keyboard navigation
- `InputArea.tsx` - Input with chips, file picker integration
- `useChat.ts` - Reducer-based chat state management
- `useContextChips.ts` - Chip state management
- `useFilePicker.ts` - @ mention detection and search

### Shared Layer

**Location**: `src/shared/`
**Components**:

- `messages.ts` - 24 WebviewMessage types, payloads, factories, guards
- `types.ts` - ProcessStatus, ChatMessage, MessageContext
- `errors.ts` - GooseError discriminated union, factory functions
- `contextTypes.ts` - ContextChip, FileSearchResult
- `fileReferenceParser.ts` - Parse file references from markdown

## Key Data Flows

### User Chat Message Flow

```mermaid
sequenceDiagram
    participant User
    participant Webview
    participant Extension
    participant JsonRpc
    participant goose

    User->>Webview: Type message + Enter
    Webview->>Extension: SEND_MESSAGE
    Extension->>Extension: Build ACP content blocks
    Extension->>JsonRpc: session/prompt request
    JsonRpc->>goose: JSON-RPC via stdin

    loop Streaming Response
        goose-->>JsonRpc: session/update notification
        JsonRpc-->>Extension: onNotification callback
        Extension-->>Webview: STREAM_TOKEN
        Webview-->>User: Render markdown chunk
    end

    Extension-->>Webview: GENERATION_COMPLETE
```

### Send Selection to Goose (Cmd+Shift+G)

1. User selects code and presses Cmd+Shift+G
2. `registerContextCommands` handler triggered
3. `goose.chatView.focus` reveals panel
4. `waitForReady()` ensures webview initialized
5. `createAddContextChipMessage()` sent with file/range
6. Webview displays chip and awaits user prompt

### File Search (@ Picker)

1. User types @ in chat input
2. `detectAtTrigger()` scans backwards for @ at word boundary
3. Webview sends FILE_SEARCH message with query
4. `fileSearchService.search()` uses `vscode.workspace.findFiles()`
5. Results sorted by recentScore
6. SEARCH_RESULTS message sent back
7. FilePicker dropdown displayed

### Version-Gated Activation

1. `discoverBinary()` locates goose binary
2. `checkVersion()` spawns `goose --version`
3. `meetsMinimumVersion()` validates >= 1.16.0
4. If version fails: `updateVersionStatus()` blocks UI
5. If version passes: spawn subprocess

## Integration Points

### Goose ACP Subprocess

- **Protocol**: JSON-RPC 2.0 over stdin/stdout (ndjson framing)
- **Methods**: `initialize`, `session/new`, `session/load`, `session/prompt`
- **Notifications**: `session/cancel`, `session/update`
- **Version Requirement**: >= 1.16.0

### VS Code APIs

- **Workspace**: `findFiles()` for @ picker
- **Commands**: `goose.showLogs`, `goose.restart`, `goose.sendSelectionToChat`
- **Keybindings**: Cmd+Shift+G for sendSelectionToChat
- **Context Menus**: editor/context menu integration

## Deployment

- **Distribution**: VS Code Marketplace via VSIX
- **Build**: Bun bundler, Webpack, Tailwind CSS v4
- **Linting**: Biome for formatting and linting
- **Webview Options**: `retainContextWhenHidden: true`
- **Version Gate**: Checks goose >= 1.16.0 before subprocess spawn
