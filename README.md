# Goose for VS Code

Bring [Goose](https://block.github.io/goose/)—the open-source, on-device AI agent—directly into your editor. Chat with Goose, reference your code, and let it handle full-stack engineering tasks without ever leaving VS Code.

![Screenshot](./resources/screenshot.gif)

> **Note:** This extension is under active development. Some features may change as we continue to improve the experience. We appreciate your feedback!

## Features

### Chat with Context

Ask Goose questions about your code with full file context. Select code in your editor and send it to Goose with a single keystroke, or type `@` to search and attach any file from your workspace.

### Context Chips

Attach multiple files or code selections to your messages. Visual chips show exactly what context Goose sees, with support for both entire files and specific line ranges.

### Session Management

Pick up where you left off. Your conversations persist across VS Code sessions with full history—browse past chats organized by time and switch between sessions instantly.

### Streaming Responses

See Goose think in real-time. Responses stream token-by-token with syntax-highlighted code blocks and one-click copy.

## Requirements

- **VS Code 1.95.0+**
- **Goose Desktop 1.16.0+** — [Install Goose](https://block.github.io/goose/)

## Installation

### From VS Code Marketplace (Recommended)

[Install from Marketplace](https://marketplace.visualstudio.com/items?itemName=block.vscode-goose)

### From GitHub Releases

1. Download the `.vsix` from [Releases](https://github.com/block/vscode-goose/releases)
2. In VS Code: Extensions → `...` menu → Install from VSIX...

## Quick Start

1. Click the Goose icon in the Activity Bar
2. Start typing your question
3. Use `@` to attach files or <kbd>Cmd+Shift+G</kbd> to send selected code

## Usage

### Send Code to Goose

Select code in your editor and press <kbd>Cmd+Shift+G</kbd> (macOS) or <kbd>Ctrl+Shift+G</kbd> (Windows/Linux). You can also right-click and choose **Send to Goose**.

- **No selection**: Sends the entire file as context
- **Small selection** (<100 lines): Included inline with your message
- **Large selection** (≥100 lines): Added as a context chip

### Attach Files with @ Mentions

Type `@` in the chat input to search your workspace. Select a file to add it as a context chip—Goose will see the full file contents.

### Manage Sessions

- **New Chat**: Start a fresh conversation
- **History**: Browse and resume past sessions grouped by Today, Yesterday, and older

## Keyboard Shortcuts

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Send selection to Goose | <kbd>Cmd+Shift+G</kbd> | <kbd>Ctrl+Shift+G</kbd> |

## Configuration

| Setting | Description |
|---------|-------------|
| `goose.binaryPath` | Path to Goose binary (auto-detected by default) |
| `goose.logLevel` | Logging level: `error`, `warn`, `info`, `debug` |

Goose reads its provider and model configuration from:

- **macOS/Linux**: `~/.config/goose/config.yaml`
- **Windows**: `%APPDATA%\Block\goose\config\config.yaml`

## Commands

- **Goose: Show Logs** — View extension logs
- **Goose: Restart** — Restart the Goose connection

## Support

Questions or issues? Open an issue on [GitHub](https://github.com/block/vscode-goose/issues).

## License

Apache-2.0 — see [LICENSE](./LICENSE)
