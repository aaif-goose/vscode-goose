---
scope: kbRoot
path_pattern: "index.md"
producer: knowledge-base
type: document
description: "Project overview and progressive KB entry point. Always generated -- serves as the navigation hub for all other KB documents."
strictness: strict
---
# vscode-goose — Knowledge Base

**Type**: Single Project
**Languages**: TypeScript, TSX, CSS
**Version**: 0.2.1
**Updated**: 2026-04-23

## Project Summary

vscode-goose is a VS Code extension that provides a thin UI bridge over ACP (Agent Communication Protocol) to the Goose AI agent subprocess. The extension owns no AI behavior — it orchestrates VS Code surfaces (chat webview, editor selection, commands) with a locally-spawned `goose` binary (≥ 1.16.0) over JSON-RPC 2.0 on ndjson-framed stdio.

## Quick Reference

| Aspect | Value |
|--------|-------|
| Entry Point | `src/extension/extension.ts` (`activate()` on `onStartupFinished`) |
| Webview Entry | `src/webview/index.tsx` → `<App />` |
| Key Pattern | Thin UI bridge; message-driven; version-gated activation |
| Error Model | fp-ts `TaskEither<GooseError, T>` |
| Tech Stack | VS Code API `^1.95.0`, React 19, Tailwind 4, fp-ts 2, react-markdown |
| Runtime / Tooling | Bun (runtime + bundler + tests), Biome 2 (lint+format), Husky + commitlint, release-please |
| Packaging | `vsce package --no-dependencies` → VSIX, tag prefix `vscode-v`, publisher `block` |

## KB File Manifest

**Progressive Loading**: Load files on-demand based on your task.

| File | Lines | Load For |
|------|-------|----------|
| architecture.md | ~218 | System design, component relationships, data flows, deployment |
| interaction-model.md | ~122 | Cross-surface interaction semantics, UX principles, a11y |
| modules.md | ~170 | Component breakdown, module responsibilities, metrics |
| patterns.md | ~121 | Code conventions, error handling, testing, tooling |
| concept_map.md | ~146 | Domain terminology, ACP vocabulary, type relationships |

## Task-Based Loading

| Task | Files to Load |
|------|---------------|
| Code review | `patterns.md` |
| Bug investigation | `architecture.md`, `modules.md` |
| Feature implementation | `modules.md`, `patterns.md` |
| Frontend / UX / surface work | `interaction-model.md`, `modules.md`, `patterns.md` |
| Strategic analysis | ALL files |

## How to Load

```
Read: .rp1/context/{filename}
```

## Project Structure

```
src/
├── extension/        # Node host: activation, subprocess, ACP client, session mgmt, webview provider
├── webview/          # React 19 iframe UI
│   ├── components/   # chat/, picker/, session/, markdown/, icons/, VersionBlockedView
│   ├── hooks/        # useChat, useSession, useContextChips, useFilePicker, useKeyboardNav, useAutoScroll
│   ├── App.tsx · index.tsx · bridge.ts · theme.ts · styles.css
└── shared/           # Cross-boundary types: messages, types, contextTypes, sessionTypes, errors, fileReferenceParser
src/test/mocks/       # Shared test doubles (vscode API, ndjson streams)
.github/workflows/    # ci.yml (main + release-please), pr-checks.yml
```

## Navigation

- **[architecture.md](architecture.md)** — System design, Mermaid topology, data flows, CI/release
- **[interaction-model.md](interaction-model.md)** — Surfaces, user-visible states, feedback loops, a11y
- **[modules.md](modules.md)** — Module inventory, component table, dependency graph, metrics
- **[patterns.md](patterns.md)** — Conventions, typing, error channel, tooling (Bun + Biome)
- **[concept_map.md](concept_map.md)** — Types, glossary (Goose, ACP, chips, sessionUpdate), relationships
