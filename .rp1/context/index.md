# VS Code Goose - Knowledge Base

**Type**: Single Project
**Languages**: TypeScript, TSX (React)
**Version**: 0.1.0
**Updated**: 2025-12-21

## Project Summary

VS Code extension providing a thin UI bridge to Goose AI agent via Agent Communication Protocol (ACP). Enables chat-based coding assistance with context attachment, file search, and session management directly within VS Code.

## Quick Reference

| Aspect | Value |
|--------|-------|
| Entry Point | `src/extension/extension.ts` |
| Key Pattern | Bridge/Adapter with Message-Driven Communication |
| Tech Stack | TypeScript, React 19, Tailwind CSS 4, fp-ts, Bun |

## KB File Manifest

**Progressive Loading**: Load files on-demand based on your task.

| File | Lines | Load For |
|------|-------|----------|
| architecture.md | ~137 | System design, component relationships, data flows |
| modules.md | ~160 | Component breakdown, module responsibilities |
| patterns.md | ~70 | Code conventions, implementation patterns |
| concept_map.md | ~150 | Domain terminology, business concepts |

## Task-Based Loading

| Task | Files to Load |
|------|---------------|
| Code review | `patterns.md` |
| Bug investigation | `architecture.md`, `modules.md` |
| Feature implementation | `modules.md`, `patterns.md` |
| Context chip work | `concept_map.md`, `modules.md` |
| Strategic analysis | ALL files |

## How to Load

```
Read: .rp1/context/{filename}
```

## Project Structure

```
src/
├── extension/      # VS Code extension host (Node.js)
│   ├── extension.ts      # Main entry, activation orchestration
│   ├── subprocessManager.ts # Goose process lifecycle
│   ├── jsonRpcClient.ts  # ACP JSON-RPC communication
│   ├── sessionManager.ts # Session lifecycle, ACP coordination
│   ├── versionChecker.ts # Binary version validation (>= 1.16.0)
│   ├── fileSearchService.ts # @ file picker search
│   ├── commands.ts       # Command registration (Cmd+Shift+G)
│   └── webviewProvider.ts # Webview lifecycle, ready sync
├── webview/        # React chat UI (sandboxed iframe)
│   ├── App.tsx           # Root with status, session, chat
│   ├── bridge.ts         # postMessage abstraction
│   ├── hooks/            # useChat, useContextChips, useFilePicker
│   ├── components/
│   │   ├── chat/         # ChatView, InputArea, ChipStack
│   │   ├── picker/       # FilePicker dropdown
│   │   └── session/      # SessionHeader, SessionList
└── shared/         # Shared types between extension/webview
    ├── messages.ts       # 24 WebviewMessage types
    ├── types.ts          # ProcessStatus, ChatMessage
    ├── errors.ts         # GooseError discriminated union
    ├── contextTypes.ts   # ContextChip, FileSearchResult
    └── fileReferenceParser.ts # Parse file refs from markdown
```

## Key Features

- **Context Chips**: Attach files/selections via @ picker or Cmd+Shift+G
- **Version Gating**: Validates goose >= 1.16.0 before activation
- **Session Management**: Persistent sessions with history replay
- **Streaming Responses**: Token-by-token AI response display
- **fp-ts Error Handling**: TaskEither for typed async errors

## Navigation

- **[architecture.md](architecture.md)**: System design and diagrams
- **[modules.md](modules.md)**: Component breakdown
- **[patterns.md](patterns.md)**: Code conventions
- **[concept_map.md](concept_map.md)**: Domain terminology
