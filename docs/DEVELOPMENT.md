# Goose VS Code Extension Development

This document provides information for developers working on the Goose VS Code extension.
For user documentation, see the main [README.md](../README.md).
For architectural details, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Dev Setup

1. Clone the repository
2. Install [Bun](https://bun.sh/) if not already installed
3. Navigate to the project root directory
4. Install dependencies: `bun install`
5. Build the extension: `bun run build`
6. Open the project in VS Code: `code .`
7. Press F5 to start debugging

## Project Structure

```
src/
├── extension/          # VS Code extension host (Node.js)
│   ├── extension.ts    # Main entry point
│   ├── subprocessManager.ts
│   ├── jsonRpcClient.ts
│   ├── sessionManager.ts
│   ├── webviewProvider.ts
│   └── ...
├── webview/            # React chat UI (sandboxed iframe)
│   ├── App.tsx
│   ├── bridge.ts
│   ├── hooks/
│   │   ├── useChat.ts
│   │   ├── useSession.ts
│   │   ├── useContextChips.ts
│   │   └── useFilePicker.ts
│   └── components/
│       ├── chat/
│       │   ├── SessionSettingsBar.tsx
│       │   ├── ThinkingBlock.tsx
│       │   └── ToolCallCard.tsx
│       └── session/
└── shared/             # Shared types between extension/webview
    ├── messages.ts
    ├── types.ts
    ├── sessionTypes.ts
    └── errors.ts
```

Recent UI work worth knowing before making changes:

- `App.tsx` owns the animated right-side history pane and responsive split/overlay behavior.
- `useChat.ts` assembles assistant replies from structured stream parts instead of plain text only.
- `InputArea.tsx` now hosts session mode/model selectors via `SessionSettingsBar`.
- `extension.ts` translates ACP session updates into webview messages for text, thinking, tool calls, and session settings.

## Build Process

The extension uses Bun for building. All scripts are defined in `package.json`:

### Build Commands

| Command | Description |
|---------|-------------|
| `bun run build` | Full build: extension + webview + CSS |
| `bun run build:extension` | Build extension only |
| `bun run build:webview` | Build webview React app |
| `bun run build:webview:css` | Build Tailwind CSS |
| `bun run dev` | Watch mode for extension development |
| `bun run clean` | Remove dist directory |

### Build Details

1. **Extension Build** (`build:extension`): Uses Bun to bundle `src/extension/extension.ts` into `dist/extension.js` with CommonJS format for Node.js. The `vscode` module is external.

2. **Webview Build** (`build:webview`): Uses Bun to bundle `src/webview/index.tsx` into `dist/webview/main.js` with minification.

3. **CSS Build** (`build:webview:css`): Uses Tailwind CSS v4 to compile `src/webview/styles.css` into `dist/webview/styles.css`.

## Testing

### Running Tests

Run tests from the project root:

| Command | Description |
|---------|-------------|
| `bun test` | Run all tests |
| `bun test --watch` | Run tests in watch mode |

### Writing Tests

Tests are co-located with source files using the `*.test.ts` naming convention:

- `src/extension/versionChecker.test.ts`
- `src/shared/fileReferenceParser.test.ts`
- `src/extension/jsonRpcClient.test.ts`

Use the Bun test runner with the following pattern:

```typescript
import { describe, it, expect } from "bun:test";

describe("MyModule", () => {
  it("should do something", () => {
    expect(result).toBe(expected);
  });
});
```

## Linting and Formatting

This project uses [Biome](https://biomejs.dev/) for linting and formatting.

| Command | Description |
|---------|-------------|
| `bun run lint` | Run linter |
| `bun run lint:fix` | Run linter with auto-fix |
| `bun run format` | Format code |
| `bun run check` | Run both lint and format checks |
| `bun run check:fix` | Fix both lint and format issues |
| `bun run ci` | CI mode (fails on issues) |

## Packaging

To create a `.vsix` package for local testing:

```bash
bun run package
```

This will:

1. Build the extension
2. Build the webview
3. Compile Tailwind CSS
4. Package with `vsce`

## Commit Message Guidelines

This project uses **Conventional Commits** ([v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)) with [commitlint](https://commitlint.js.org/) enforced via Husky pre-commit hooks.

### Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Common Types

| Type | Description | SemVer Impact |
|------|-------------|---------------|
| `feat` | New feature | Minor |
| `fix` | Bug fix | Patch |
| `perf` | Performance improvement | Patch |
| `refactor` | Code change (no feature/fix) | None |
| `style` | Formatting changes | None |
| `test` | Adding/fixing tests | None |
| `build` | Build system changes | None |
| `ci` | CI configuration changes | None |
| `docs` | Documentation only | None |
| `chore` | Other maintenance | None |

### Breaking Changes

Indicate breaking changes with `!` after type/scope:

```
feat!: change API endpoint structure
```

### Examples

```
feat(webview): add support for multiple chat sessions
fix(subprocess): prevent crash when goose path is invalid
docs: update architecture diagram
refactor(jsonrpc): simplify error handling
chore(deps): update typescript to 5.8.0
```

## Configuration

The extension exposes these VS Code settings:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `goose.binaryPath` | string | `""` | Path to goose binary (empty = auto-detect) |
| `goose.logLevel` | enum | `"info"` | Logging level: error, warn, info, debug |

## Commands

Registered commands accessible via Command Palette:

| Command | ID | Description |
|---------|-----|-------------|
| Goose: Show Logs | `goose.showLogs` | Open output channel |
| Goose: Restart | `goose.restart` | Restart goose subprocess |
| Send to Goose | `goose.sendSelectionToChat` | Send selection to chat (Cmd+Shift+G) |

## ACP/Streaming Notes

- `session/prompt` requests are sent with `timeoutMs: null` in `JsonRpcClient`, so long-running prompts should not time out locally.
- Assistant output can arrive as plain text chunks, thinking chunks, and tool-call lifecycle events.
- Session metadata can include selectable mode/model settings that are mirrored into the composer UI and updated through ACP methods.

## Debugging

### Extension Debugging

1. Set breakpoints in `src/extension/*.ts` files
2. Press F5 to launch Extension Development Host
3. The debugger will attach automatically

### Webview Debugging

1. In Extension Development Host, open the Goose panel
2. Open Command Palette > "Developer: Open Webview Developer Tools"
3. Use Chrome DevTools to debug React components

### Subprocess Debugging

View goose communication:

1. Run "Goose: Show Logs" command
2. Set `goose.logLevel` to `debug` for verbose output

## Dependencies

### Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| fp-ts | ^2.16.0 | Functional programming (Either, TaskEither) |
| react-markdown | ^10.1.0 | Markdown rendering |
| react-syntax-highlighter | ^15.6.1 | Code syntax highlighting |
| remark-gfm | ^4.0.1 | GitHub Flavored Markdown |
| zod | ^3.23.0 | Runtime type validation |

### Dev Dependencies

| Package | Purpose |
|---------|---------|
| @biomejs/biome | Linting and formatting |
| @tailwindcss/cli | CSS framework |
| @vscode/vsce | Extension packaging |
| typescript | Type checking |
| husky | Git hooks |
| @commitlint/* | Commit message linting |

## Known Issues

Refer to the [GitHub issues page](https://github.com/block/vscode-goose/issues) for known issues.
