# Goose for VS Code

## Install (SHA-256)

Pin GitHub Release **v0.6.0** and verify `SHA256SUMS`. Website `install.sh` / `install.ps1` abort on mismatch.

https://github.com/LinespottingOrg/GrokBuildRemote-Agents/releases/tag/v0.6.0
https://github.com/LinespottingOrg/GrokBuildRemote-Agents/blob/main/docs/PINNED-INSTALL.md

```
96cef605d3e030ccef99d27ea6240e0d3b668dd045e6b5b9e585c9fd03c6ef23  gbr-agent-darwin-amd64
de7e065ef2cf6877b3b2cd04679a67b627f876337f529247e236204543e4062c  gbr-agent-darwin-arm64
a50a5c41993e6531a3b477eb409ccc845212bf541384dc803061c80657f86719  gbr-agent-linux-amd64
5bfd22c7110234942c4c02ff8154b836d0af45a9422c178a4f52010187d40061  gbr-agent-linux-arm64
f773b89fd31310172b756e0593e0f3b2382b0a3440af2a7d0a8b3073b0c23e27  gbr-agent-windows-amd64.exe
8fb9efcbc7e2ac91c11964944bf0f45e31bb23f4356d9dcb4b305d7cb9b0fe8c  gbr-agent-windows-arm64.exe
```

```bash
VER=v0.6.0
BASE=https://github.com/LinespottingOrg/GrokBuildRemote-Agents/releases/download/$VER
# swap darwin-arm64 for your OS/arch
curl -fsSL -o gbr-agent-darwin-arm64 "$BASE/gbr-agent-darwin-arm64"
curl -fsSL -o SHA256SUMS "$BASE/SHA256SUMS"
shasum -a 256 -c SHA256SUMS --ignore-missing
gbr-agent pair && gbr-agent run
```


Bring [Goose](https://goose-docs.ai/)—the open-source, on-device AI agent—directly into your editor. Chat with Goose, reference your code, and let it handle full-stack engineering tasks without ever leaving VS Code.

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
- **Goose CLI 1.16.0+** — [Install Goose](https://goose-docs.ai/docs/quickstart/) and ensure `goose --version` works from your command line.

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

## Spectator phone (Build Remote Agent)

This extension stays a thin ACP bridge to the local Goose CLI. To spectate the **desktop** Goose session from a phone, pair [Build Remote Agent](https://grokbuildremote.com/) via the free MIT [`gbr-agent`](https://github.com/LinespottingOrg/GrokBuildRemote-Agents). Protocol `gbr/1`. Phone is spectator + veto, not orchestrator. Independent product — not affiliated with xAI or SpaceX. No extra VS Code UI.


Attach only `http://127.0.0.1:8788` or stdio `gbr-mcp`. Unpair in the phone app before switching PCs. Never commit mailbox keys.

## License

Apache-2.0 — see [LICENSE](./LICENSE)

## What the phone sees

**Terminal windows** on this PC (machine-wide mailbox). Not headless OpenCode / CodeNomad sidecar / Electron. `:8788` in a sidecar is Bot API JSON, not a transcript.

https://github.com/LinespottingOrg/GrokBuildRemote-Agents/blob/main/docs/WHAT-THE-PHONE-SEES.md
https://grokbuildremote.com/integrations.html
